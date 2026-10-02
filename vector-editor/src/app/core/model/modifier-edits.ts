import { evaluateObjectPrefix } from '../eval/evaluate';
import { remintSource } from '../eval/remint';
import { createId } from './create-id';
import { isEmptyPoint } from './empty-point';
import { Modifier, Style, VectorObject } from './types';

export interface ModifierPatch {
  readonly enabled?: boolean;
  readonly count?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly axis?: 'x' | 'y' | 'xy';
  readonly centerPointId?: string | null;
  readonly distance?: number;
  readonly join?: 'bevel' | 'miter' | 'round';
  readonly miterLimit?: number;
  readonly mode?: 'direct' | 'smooth' | 'circle';
  readonly anchorCount?: number;
  readonly roundness?: number;
  readonly operation?: 'union' | 'difference' | 'intersect';
  readonly operandId?: string;
}

export type ModifierKind = 'array' | 'mirror' | 'bevel' | 'round' | 'boolean';

export function addModifier(
  object: VectorObject,
  kind: ModifierKind,
  objects: readonly VectorObject[] = [],
): VectorObject {
  if (isEmptyPoint(object)) {
    return object;
  }
  const modifier = defaultModifier(object, kind, objects);
  return { ...object, modifiers: [...object.modifiers, modifier] };
}

export function updateModifier(
  object: VectorObject,
  modifierId: string,
  patch: ModifierPatch,
): VectorObject {
  if (isEmptyPoint(object)) {
    return object;
  }
  let changed = false;
  const modifiers = object.modifiers.map((modifier) => {
    if (modifier.id !== modifierId) {
      return modifier;
    }
    const next = patchModifier(modifier, patch);
    if (next !== modifier) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...object, modifiers } : object;
}

export function removeModifier(object: VectorObject, modifierId: string): VectorObject {
  if (isEmptyPoint(object)) {
    return object;
  }
  const modifiers = object.modifiers.filter((modifier) => modifier.id !== modifierId);
  return modifiers.length === object.modifiers.length ? object : { ...object, modifiers };
}

export function reorderModifier(
  object: VectorObject,
  modifierId: string,
  index: number,
): VectorObject {
  if (isEmptyPoint(object)) {
    return object;
  }
  const from = object.modifiers.findIndex((modifier) => modifier.id === modifierId);
  if (from < 0 || !Number.isInteger(index)) {
    return object;
  }
  const to = Math.max(0, Math.min(index, object.modifiers.length - 1));
  if (from === to) {
    return object;
  }
  const modifiers = [...object.modifiers];
  const [moved] = modifiers.splice(from, 1);
  if (!moved) {
    return object;
  }
  modifiers.splice(to, 0, moved);
  return { ...object, modifiers };
}

export function applyModifier(
  object: VectorObject,
  modifierId: string,
  objects: readonly VectorObject[] = [object],
): VectorObject {
  if (isEmptyPoint(object)) {
    return object;
  }
  const index = object.modifiers.findIndex((modifier) => modifier.id === modifierId);
  if (index < 0) {
    return object;
  }
  return bake(
    object,
    evaluateObjectPrefix(object, object.modifiers.slice(0, index + 1), objects),
    object.modifiers.slice(index + 1),
  );
}

export function applyAllModifiers(
  object: VectorObject,
  objects: readonly VectorObject[] = [object],
): VectorObject {
  if (isEmptyPoint(object) || object.modifiers.length === 0) {
    return object;
  }
  return bake(object, evaluateObjectPrefix(object, object.modifiers, objects), []);
}

function bake(
  object: VectorObject,
  evaluated: {
    readonly subpaths: VectorObject['source']['subpaths'];
    readonly fillRule: Style['fillRule'];
  },
  modifiers: readonly Modifier[],
): VectorObject {
  const style =
    evaluated.fillRule === object.style.fillRule
      ? object.style
      : { ...object.style, fillRule: evaluated.fillRule };
  return {
    ...object,
    source: remintSource({ subpaths: evaluated.subpaths }),
    style,
    modifiers,
  };
}

function defaultModifier(
  object: VectorObject,
  kind: ModifierKind,
  objects: readonly VectorObject[],
): Modifier {
  switch (kind) {
    case 'array':
      return defaultArray();
    case 'mirror':
      return defaultMirror();
    case 'bevel':
      return defaultBevel();
    case 'round':
      return defaultRound(object, objects);
    case 'boolean':
      return defaultBoolean(object.id, objects);
  }
}

function defaultArray(): Modifier {
  return {
    id: createId(),
    type: 'array',
    count: 3,
    offsetX: 40,
    offsetY: 0,
    enabled: true,
  };
}

function defaultMirror(): Modifier {
  return {
    id: createId(),
    type: 'mirror',
    axis: 'x',
    enabled: true,
  };
}

function defaultBevel(): Modifier {
  return {
    id: createId(),
    type: 'bevel',
    distance: 8,
    join: 'bevel',
    miterLimit: 4,
    enabled: true,
  };
}

function defaultRound(object: VectorObject, objects: readonly VectorObject[]): Modifier {
  const evaluated = evaluateObjectPrefix(object, object.modifiers, objects);
  const anchorCount = evaluated.subpaths.find((subpath) => subpath.anchors.length > 0)?.anchors.length ?? 4;
  return {
    id: createId(),
    type: 'round',
    mode: 'direct',
    anchorCount,
    roundness: 50,
    enabled: true,
  };
}

function defaultBoolean(objectId: string, objects: readonly VectorObject[]): Modifier {
  const operand = objects.find((item) => item.id !== objectId && !isEmptyPoint(item));
  return {
    id: createId(),
    type: 'boolean',
    operation: 'difference',
    operandId: operand?.id ?? '',
    enabled: true,
  };
}

function patchModifier(modifier: Modifier, patch: ModifierPatch): Modifier {
  const enabled = patch.enabled !== undefined ? patch.enabled : modifier.enabled;
  if (modifier.type === 'array') {
    const count =
      patch.count !== undefined && Number.isFinite(patch.count)
        ? Math.max(1, Math.floor(patch.count))
        : modifier.count;
    const offsetX = finite(patch.offsetX, modifier.offsetX);
    const offsetY = finite(patch.offsetY, modifier.offsetY);
    if (
      enabled === modifier.enabled &&
      count === modifier.count &&
      offsetX === modifier.offsetX &&
      offsetY === modifier.offsetY
    ) {
      return modifier;
    }
    return { ...modifier, enabled, count, offsetX, offsetY };
  }
  if (modifier.type === 'mirror') {
    const axis = patch.axis ?? modifier.axis;
    const centerPointId =
      patch.centerPointId === undefined
        ? modifier.centerPointId
        : patch.centerPointId === null || patch.centerPointId.length === 0
          ? undefined
          : patch.centerPointId;
    if (
      enabled === modifier.enabled &&
      axis === modifier.axis &&
      centerPointId === modifier.centerPointId
    ) {
      return modifier;
    }
    if (centerPointId === undefined) {
      const { centerPointId: _centerPointId, ...withoutCenterPoint } = modifier;
      return { ...withoutCenterPoint, enabled, axis };
    }
    return { ...modifier, enabled, axis, centerPointId };
  }
  if (modifier.type === 'bevel') {
    const distance = finite(patch.distance, modifier.distance);
    const join = patch.join ?? modifier.join;
    const miterLimit = finite(patch.miterLimit, modifier.miterLimit);
    if (
      enabled === modifier.enabled &&
      distance === modifier.distance &&
      join === modifier.join &&
      miterLimit === modifier.miterLimit
    ) {
      return modifier;
    }
    return { ...modifier, enabled, distance, join, miterLimit };
  }
  if (modifier.type === 'round') {
    const mode = patch.mode ?? modifier.mode ?? 'direct';
    const anchorCount =
      patch.anchorCount !== undefined && Number.isFinite(patch.anchorCount)
        ? Math.min(1000, Math.max(2, Math.floor(patch.anchorCount)))
        : modifier.anchorCount;
    const roundness =
      patch.roundness !== undefined && Number.isFinite(patch.roundness)
        ? Math.max(0, Math.min(100, patch.roundness))
        : modifier.roundness;
    if (
      enabled === modifier.enabled &&
      mode === modifier.mode &&
      anchorCount === modifier.anchorCount &&
      roundness === modifier.roundness
    ) {
      return modifier;
    }
    return { ...modifier, enabled, mode, anchorCount, roundness };
  }
  const operation = patch.operation ?? modifier.operation;
  const operandId = patch.operandId !== undefined ? patch.operandId : modifier.operandId;
  if (
    enabled === modifier.enabled &&
    operation === modifier.operation &&
    operandId === modifier.operandId
  ) {
    return modifier;
  }
  return { ...modifier, enabled, operation, operandId };
}

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
