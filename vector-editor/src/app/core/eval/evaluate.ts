import {
  applyMatrix,
  identityTransform,
  invertMatrix,
  matrixFromTransform,
} from '../io/matrix';
import { isEmptyPoint } from '../model/empty-point';
import { Modifier, SourcePath, Style, Subpath, VectorObject } from '../model/types';
import { applyArray } from './array';
import { applyBevel } from './bevel';
import { clipBoolean, hasOpenSubpath, placeOperand } from './boolean';
import { applyMirror } from './mirror';
import { applyRound } from './round';

export interface EvaluatedGeometry {
  readonly objectId: string;
  readonly subpaths: readonly Subpath[];
  readonly diagnostics: readonly string[];
  readonly fillRule: Style['fillRule'];
}

export interface EvaluatedSource {
  readonly source: SourcePath;
  readonly diagnostics: readonly string[];
}

export interface ClipperHold {
  readonly steps: Readonly<Record<string, SourcePath>>;
}

interface StackResult {
  readonly source: SourcePath;
  readonly diagnostics: readonly string[];
  readonly booleanRan: boolean;
}

const plainStyle: Style = {
  fill: null,
  stroke: null,
  strokeWidth: 1,
  fillRule: 'nonzero',
};

export function evaluateDocument(
  objects: readonly VectorObject[],
  hold: ClipperHold | null = null,
  record?: Record<string, SourcePath>,
): readonly EvaluatedGeometry[] {
  const context = createContext(objects, hold, record ?? null);
  return objects.map((object) => {
    const result = context.evaluate(object);
    return {
      objectId: object.id,
      subpaths: result.source.subpaths,
      diagnostics: result.diagnostics,
      fillRule: result.booleanRan ? 'evenodd' : object.style.fillRule,
    };
  });
}

export function evaluateObject(object: VectorObject): EvaluatedGeometry {
  return (
    evaluateDocument([object]).find((item) => item.objectId === object.id) ?? {
      objectId: object.id,
      subpaths: object.source.subpaths,
      diagnostics: [],
      fillRule: object.style.fillRule,
    }
  );
}

export function evaluateObjectPrefix(
  object: VectorObject,
  modifiers: readonly Modifier[],
  objects: readonly VectorObject[],
): EvaluatedGeometry {
  const standIn = { ...object, modifiers };
  const group = objects.map((item) => (item.id === object.id ? standIn : item));
  const all = group.some((item) => item.id === standIn.id) ? group : [standIn, ...group];
  return (
    evaluateDocument(all).find((item) => item.objectId === object.id) ?? {
      objectId: object.id,
      subpaths: object.source.subpaths,
      diagnostics: [],
      fillRule: object.style.fillRule,
    }
  );
}

export function captureClipperHold(objects: readonly VectorObject[]): ClipperHold {
  const steps: Record<string, SourcePath> = {};
  evaluateDocument(objects, null, steps);
  return { steps };
}

export function evaluateSource(
  source: SourcePath,
  modifiers: readonly Modifier[],
): EvaluatedSource {
  const object: VectorObject = {
    id: 'source',
    name: '',
    layerId: '',
    visible: true,
    locked: false,
    kind: 'path',
    source,
    style: plainStyle,
    transform: identityTransform,
    modifiers,
  };
  const result = createContext([object], null, null).evaluate(object);
  return { source: result.source, diagnostics: result.diagnostics };
}

function createContext(
  objects: readonly VectorObject[],
  hold: ClipperHold | null,
  record: Record<string, SourcePath> | null,
): { evaluate: (object: VectorObject) => StackResult } {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const cyclic = cyclicModifierIds(objects);
  const memo = new Map<string, StackResult>();
  const visiting = new Set<string>();

  const evaluate = (object: VectorObject): StackResult => {
    const cached = memo.get(object.id);
    if (cached) {
      return cached;
    }
    if (visiting.has(object.id)) {
      return { source: object.source, diagnostics: [], booleanRan: false };
    }
    visiting.add(object.id);
    const result = walkStack(object, hold, record, cyclic, byId, evaluate);
    visiting.delete(object.id);
    memo.set(object.id, result);
    return result;
  };

  return { evaluate };
}

function walkStack(
  object: VectorObject,
  hold: ClipperHold | null,
  record: Record<string, SourcePath> | null,
  cyclic: ReadonlySet<string>,
  byId: ReadonlyMap<string, VectorObject>,
  evaluate: (object: VectorObject) => StackResult,
): StackResult {
  if (isEmptyPoint(object)) {
    return { source: { subpaths: [] }, diagnostics: [], booleanRan: false };
  }
  const diagnostics: string[] = [];
  let current = object.source;
  let booleanRan = false;

  for (const modifier of object.modifiers) {
    if (!modifier.enabled) {
      continue;
    }
    if (modifier.type === 'array') {
      current = applyArray(current, modifier);
      continue;
    }
    if (modifier.type === 'mirror') {
      if (modifier.centerPointId === undefined) {
        current = applyMirror(current, modifier);
        continue;
      }
      const point = byId.get(modifier.centerPointId);
      if (!point || !isEmptyPoint(point)) {
        diagnostics.push('Mirror reference point is missing.');
        continue;
      }
      const inverse = invertMatrix(matrixFromTransform(object.transform));
      if (!inverse) {
        diagnostics.push('Mirror reference point cannot be transformed into object space.');
        continue;
      }
      const worldPoint = applyMatrix(matrixFromTransform(point.transform), { x: 0, y: 0 });
      current = applyMirror(current, modifier, applyMatrix(inverse, worldPoint));
      continue;
    }
    if (modifier.type === 'round') {
      current = applyRound(current, modifier);
      continue;
    }
    const frozen = hold?.steps[modifier.id];
    if (frozen) {
      current = frozen;
      if (modifier.type === 'boolean') {
        booleanRan = true;
      }
      continue;
    }
    if (modifier.type === 'bevel') {
      if (!Number.isFinite(modifier.distance) || modifier.distance === 0) {
        continue;
      }
      const next = applyBevel(current, modifier);
      if (!next) {
        diagnostics.push('Bevel could not be computed.');
        continue;
      }
      current = next;
      if (record) {
        record[modifier.id] = current;
      }
      continue;
    }
    const step = applyBooleanModifier(object, current, modifier, cyclic, byId, evaluate);
    diagnostics.push(...step.diagnostics);
    if (step.ran && step.source) {
      current = step.source;
      booleanRan = true;
      if (record) {
        record[modifier.id] = current;
      }
    }
  }

  return { source: current, diagnostics, booleanRan };
}

function applyBooleanModifier(
  object: VectorObject,
  current: SourcePath,
  modifier: Extract<Modifier, { type: 'boolean' }>,
  cyclic: ReadonlySet<string>,
  byId: ReadonlyMap<string, VectorObject>,
  evaluate: (object: VectorObject) => StackResult,
): {
  readonly source: SourcePath | null;
  readonly diagnostics: readonly string[];
  readonly ran: boolean;
} {
  if (modifier.operandId.length === 0 || !byId.has(modifier.operandId)) {
    return { source: null, diagnostics: ['Boolean operand is missing.'], ran: false };
  }
  if (modifier.operandId === object.id) {
    return { source: null, diagnostics: ['Boolean operand is the same object.'], ran: false };
  }
  if (cyclic.has(modifier.id)) {
    return { source: null, diagnostics: ['Boolean operands form a cycle.'], ran: false };
  }
  const operand = byId.get(modifier.operandId);
  if (!operand || isEmptyPoint(operand)) {
    return { source: null, diagnostics: ['Boolean operand is missing.'], ran: false };
  }
  const placed = placeOperand(object.transform, operand.transform, evaluate(operand).source);
  if (!placed) {
    return { source: null, diagnostics: ['Boolean transform cannot be inverted.'], ran: false };
  }
  if (hasOpenSubpath(current) || hasOpenSubpath(placed)) {
    return { source: null, diagnostics: ['Boolean needs closed paths.'], ran: false };
  }
  const next = clipBoolean(current, placed, modifier);
  if (!next) {
    return { source: null, diagnostics: ['Boolean could not be computed.'], ran: false };
  }
  return { source: next, diagnostics: [], ran: true };
}

function cyclicModifierIds(objects: readonly VectorObject[]): Set<string> {
  const edges = new Map<string, { modifierId: string; operandId: string }[]>();
  for (const object of objects) {
    const list = [];
    for (const modifier of object.modifiers) {
      if (
        modifier.enabled &&
        modifier.type === 'boolean' &&
        modifier.operandId.length > 0 &&
        modifier.operandId !== object.id
      ) {
        list.push({ modifierId: modifier.id, operandId: modifier.operandId });
      }
    }
    edges.set(object.id, list);
  }

  const cyclic = new Set<string>();
  for (const [ownerId, list] of edges) {
    for (const edge of list) {
      if (reaches(edge.operandId, ownerId, edges)) {
        cyclic.add(edge.modifierId);
      }
    }
  }
  return cyclic;
}

function reaches(
  from: string,
  target: string,
  edges: ReadonlyMap<string, readonly { modifierId: string; operandId: string }[]>,
  seen = new Set<string>(),
): boolean {
  if (from === target) {
    return true;
  }
  if (seen.has(from)) {
    return false;
  }
  seen.add(from);
  for (const edge of edges.get(from) ?? []) {
    if (reaches(edge.operandId, target, edges, seen)) {
      return true;
    }
  }
  return false;
}
