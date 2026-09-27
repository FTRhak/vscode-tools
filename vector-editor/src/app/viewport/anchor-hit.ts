import { ObjectTransform, SourcePath, Vec2, VectorObject } from '@vector-editor/core';
import { DocumentRect, localToDocument } from './hit-test';

export const ANCHOR_HIT_PX = 6;

export type AnchorHit =
  | { readonly kind: 'anchor'; readonly anchorId: string }
  | { readonly kind: 'handle'; readonly anchorId: string; readonly slot: 'in' | 'out' };

export function anchorHitRadius(zoom: number, transform: ObjectTransform): number {
  const scale = Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
  const pixelsPerUnit = zoom * scale;
  if (pixelsPerUnit <= 0) {
    return ANCHOR_HIT_PX;
  }
  return ANCHOR_HIT_PX / pixelsPerUnit;
}

export function hitTestAnchor(source: SourcePath, point: Vec2, radius: number): AnchorHit | null {
  const anchor = closestAnchor(source, point, radius);
  if (anchor) {
    return { kind: 'anchor', anchorId: anchor };
  }
  const handle = closestHandle(source, point, radius);
  return handle ? { kind: 'handle', anchorId: handle.anchorId, slot: handle.slot } : null;
}

export function anchorsInRect(object: VectorObject, rect: DocumentRect): readonly string[] {
  const box = normalize(rect);
  const ids: string[] = [];
  for (const subpath of object.source.subpaths) {
    for (const anchor of subpath.anchors) {
      const point = localToDocument(object.transform, anchor.position);
      if (
        point.x >= box.minX &&
        point.x <= box.maxX &&
        point.y >= box.minY &&
        point.y <= box.maxY
      ) {
        ids.push(anchor.id);
      }
    }
  }
  return ids;
}

function closestAnchor(source: SourcePath, point: Vec2, radius: number): string | null {
  let best: { readonly id: string; readonly distance: number } | null = null;
  for (const subpath of source.subpaths) {
    for (const anchor of subpath.anchors) {
      const distance = Math.hypot(point.x - anchor.position.x, point.y - anchor.position.y);
      if (distance <= radius && (!best || distance < best.distance)) {
        best = { id: anchor.id, distance };
      }
    }
  }
  return best?.id ?? null;
}

function closestHandle(
  source: SourcePath,
  point: Vec2,
  radius: number,
): { readonly anchorId: string; readonly slot: 'in' | 'out' } | null {
  let best: {
    readonly anchorId: string;
    readonly slot: 'in' | 'out';
    readonly distance: number;
  } | null = null;
  for (const subpath of source.subpaths) {
    for (const anchor of subpath.anchors) {
      best = nearerHandle(best, anchor.id, 'in', anchor.handleIn, point, radius);
      best = nearerHandle(best, anchor.id, 'out', anchor.handleOut, point, radius);
    }
  }
  return best ? { anchorId: best.anchorId, slot: best.slot } : null;
}

function nearerHandle(
  best: {
    readonly anchorId: string;
    readonly slot: 'in' | 'out';
    readonly distance: number;
  } | null,
  anchorId: string,
  slot: 'in' | 'out',
  handle: Vec2 | null,
  point: Vec2,
  radius: number,
): { readonly anchorId: string; readonly slot: 'in' | 'out'; readonly distance: number } | null {
  if (!handle) {
    return best;
  }
  const distance = Math.hypot(point.x - handle.x, point.y - handle.y);
  if (distance > radius || (best && distance >= best.distance)) {
    return best;
  }
  return { anchorId, slot, distance };
}

function normalize(rect: DocumentRect): {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
} {
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  return {
    minX: Math.min(rect.x, x2),
    minY: Math.min(rect.y, y2),
    maxX: Math.max(rect.x, x2),
    maxY: Math.max(rect.y, y2),
  };
}
