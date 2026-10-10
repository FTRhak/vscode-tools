import { documentBounds, type Bounds } from '../core/eval/bounds';
import { evaluateDocument } from '../core/eval/evaluate';
import { isInteractionLocked } from './paint-order';
import { Document, VectorObject, ViewBox } from './types';

export type AlignEdge =
  | 'left'
  | 'horizontalCenter'
  | 'right'
  | 'top'
  | 'verticalCenter'
  | 'bottom';

export type AlignTarget = 'selection' | 'artboard' | 'first';

const ALIGN_EPSILON = 1e-6;

interface AlignCandidate {
  readonly object: VectorObject;
  readonly bounds: Bounds;
}

export function countAlignable(document: Document, ids: readonly string[]): number {
  return alignCandidates(document, ids).length;
}

export function canAlignObjects(
  document: Document,
  ids: readonly string[],
  to: AlignTarget,
): boolean {
  const measured = measureSelected(document, ids);
  const referenceId = ids[0];
  const movers = movable(document, to === 'first' ? referenceId : undefined, measured);
  return alignTargetReady(
    to,
    movers,
    measured.find((item) => item.object.id === referenceId),
  );
}

export function alignObjects(
  document: Document,
  ids: readonly string[],
  edge: AlignEdge,
  to: AlignTarget,
): Document {
  const measured = measureSelected(document, ids);
  const referenceId = ids[0];
  const reference = measured.find((item) => item.object.id === referenceId);
  const movers = movable(document, to === 'first' ? referenceId : undefined, measured);
  if (!alignTargetReady(to, movers, reference)) {
    return document;
  }
  const target =
    to === 'artboard'
      ? artboardBounds(document.viewBox)
      : to === 'first' && reference
        ? reference.bounds
        : unionBounds(movers);
  const shifts = new Map<string, number>();
  const goal = edgeValue(target, edge);
  for (const candidate of movers) {
    const delta = goal - edgeValue(candidate.bounds, edge);
    if (Number.isFinite(delta) && Math.abs(delta) >= ALIGN_EPSILON) {
      shifts.set(candidate.object.id, delta);
    }
  }
  if (shifts.size === 0) {
    return document;
  }
  const horizontal = edge === 'left' || edge === 'horizontalCenter' || edge === 'right';
  let changed = false;
  const objects = document.objects.map((object) => {
    const delta = shifts.get(object.id);
    if (delta === undefined) {
      return object;
    }
    changed = true;
    return {
      ...object,
      transform: horizontal
        ? { ...object.transform, x: object.transform.x + delta }
        : { ...object.transform, y: object.transform.y + delta },
    };
  });
  return changed ? { ...document, objects } : document;
}

function alignTargetReady(
  to: AlignTarget,
  movers: readonly AlignCandidate[],
  reference: AlignCandidate | undefined,
): boolean {
  if (to === 'artboard') {
    return movers.length >= 1;
  }
  if (to === 'selection') {
    return movers.length >= 2;
  }
  return reference !== undefined && movers.length >= 1;
}

function alignCandidates(document: Document, ids: readonly string[]): readonly AlignCandidate[] {
  return movable(document, undefined, measureSelected(document, ids));
}

function movable(
  document: Document,
  referenceId: string | undefined,
  measured: readonly AlignCandidate[],
): readonly AlignCandidate[] {
  return measured.filter(
    (item) => item.object.id !== referenceId && !isInteractionLocked(document, item.object),
  );
}

function measureSelected(document: Document, ids: readonly string[]): readonly AlignCandidate[] {
  if (ids.length === 0) {
    return [];
  }
  const wanted = new Set(ids);
  const geometry = new Map(
    evaluateDocument(document.objects).map((item) => [item.objectId, item]),
  );
  const byId = new Map<string, AlignCandidate>();
  for (const object of document.objects) {
    if (!wanted.has(object.id)) {
      continue;
    }
    const evaluated = geometry.get(object.id);
    const bounds = documentBounds(
      object,
      evaluated ? { subpaths: evaluated.subpaths } : undefined,
    );
    if (bounds) {
      byId.set(object.id, { object, bounds });
    }
  }
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

function artboardBounds(viewBox: ViewBox): Bounds {
  return {
    minX: viewBox.x,
    minY: viewBox.y,
    maxX: viewBox.x + viewBox.width,
    maxY: viewBox.y + viewBox.height,
  };
}

function unionBounds(candidates: readonly AlignCandidate[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const candidate of candidates) {
    minX = Math.min(minX, candidate.bounds.minX);
    minY = Math.min(minY, candidate.bounds.minY);
    maxX = Math.max(maxX, candidate.bounds.maxX);
    maxY = Math.max(maxY, candidate.bounds.maxY);
  }
  return { minX, minY, maxX, maxY };
}

function edgeValue(bounds: Bounds, edge: AlignEdge): number {
  switch (edge) {
    case 'left':
      return bounds.minX;
    case 'horizontalCenter':
      return (bounds.minX + bounds.maxX) / 2;
    case 'right':
      return bounds.maxX;
    case 'top':
      return bounds.minY;
    case 'verticalCenter':
      return (bounds.minY + bounds.maxY) / 2;
    case 'bottom':
      return bounds.maxY;
  }
}
