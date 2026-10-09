import { documentBounds, type Bounds } from '../eval/bounds';
import { evaluateDocument } from '../eval/evaluate';
import { isInteractionLocked } from './paint-order';
import { Document, VectorObject, ViewBox } from './types';

export type AlignEdge =
  | 'left'
  | 'horizontalCenter'
  | 'right'
  | 'top'
  | 'verticalCenter'
  | 'bottom';

export type AlignTarget = 'selection' | 'artboard';

const ALIGN_EPSILON = 1e-6;

interface AlignCandidate {
  readonly object: VectorObject;
  readonly bounds: Bounds;
}

export function countAlignable(document: Document, ids: readonly string[]): number {
  return alignCandidates(document, ids).length;
}

export function alignObjects(
  document: Document,
  ids: readonly string[],
  edge: AlignEdge,
  to: AlignTarget,
): Document {
  const candidates = alignCandidates(document, ids);
  const minimum = to === 'selection' ? 2 : 1;
  if (candidates.length < minimum) {
    return document;
  }
  const target = to === 'artboard' ? artboardBounds(document.viewBox) : unionBounds(candidates);
  const shifts = new Map<string, number>();
  const goal = edgeValue(target, edge);
  for (const candidate of candidates) {
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

function alignCandidates(document: Document, ids: readonly string[]): readonly AlignCandidate[] {
  if (ids.length === 0) {
    return [];
  }
  const wanted = new Set(ids);
  const geometry = new Map(
    evaluateDocument(document.objects).map((item) => [item.objectId, item]),
  );
  const candidates: AlignCandidate[] = [];
  for (const object of document.objects) {
    if (!wanted.has(object.id) || isInteractionLocked(document, object)) {
      continue;
    }
    const evaluated = geometry.get(object.id);
    const bounds = documentBounds(
      object,
      evaluated ? { subpaths: evaluated.subpaths } : undefined,
    );
    if (bounds) {
      candidates.push({ object, bounds });
    }
  }
  return candidates;
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
