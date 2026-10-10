import { INSERT_POINT_MARGIN } from '@vector-editor/modules/edit-path';
import { ObjectTransform, SourcePath, Vec2 } from '@vector-editor/modules/types';

export const ADD_POINT_HIT_PX = 8;

export interface SegmentHit {
  readonly segmentId: string;
  readonly t: number;
}

export function addPointHitRadius(
  zoom: number,
  transform: ObjectTransform,
  strokeWidth: number,
  hasStroke: boolean,
): number {
  const scale = Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
  const pixelsPerUnit = zoom * scale;
  const screen = pixelsPerUnit > 0 ? ADD_POINT_HIT_PX / pixelsPerUnit : ADD_POINT_HIT_PX;
  const stroke = hasStroke && strokeWidth > 0 ? strokeWidth / 2 : 0;
  return Math.max(screen, stroke);
}

export function hitTestSegment(
  source: SourcePath,
  point: Vec2,
  radius: number,
): SegmentHit | null {
  if (!Number.isFinite(radius) || radius < 0) {
    return null;
  }
  let best: { readonly segmentId: string; readonly t: number; readonly distance: number } | null =
    null;
  for (const subpath of source.subpaths) {
    const anchors = new Map(subpath.anchors.map((anchor) => [anchor.id, anchor]));
    for (const segment of subpath.segments) {
      const from = anchors.get(segment.fromId);
      const to = anchors.get(segment.toId);
      if (!from || !to) {
        continue;
      }
      const hit =
        segment.kind === 'line'
          ? closestOnLine(from.position, to.position, point)
          : closestOnCubic(from.position, from.handleOut, to.handleIn, to.position, point);
      if (!interior(hit.t) || hit.distance > radius || (best && hit.distance >= best.distance)) {
        continue;
      }
      best = { segmentId: segment.id, t: hit.t, distance: hit.distance };
    }
  }
  return best ? { segmentId: best.segmentId, t: best.t } : null;
}

function closestOnLine(
  start: Vec2,
  end: Vec2,
  point: Vec2,
): { readonly t: number; readonly distance: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return { t: 0, distance: Math.hypot(point.x - start.x, point.y - start.y) };
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return {
    t,
    distance: Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy)),
  };
}

function closestOnCubic(
  p0: Vec2,
  handleOut: Vec2 | null,
  handleIn: Vec2 | null,
  p3: Vec2,
  point: Vec2,
): { readonly t: number; readonly distance: number } {
  const p1 = handleOut ?? p0;
  const p2 = handleIn ?? p3;
  const steps = 32;
  let bestT = 0;
  let bestDistance = Infinity;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const sample = cubicAt(p0, p1, p2, p3, t);
    const distance = Math.hypot(point.x - sample.x, point.y - sample.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestT = t;
    }
  }
  let span = 1 / steps;
  for (let refine = 0; refine < 10; refine += 1) {
    const left = Math.max(0, bestT - span);
    const right = Math.min(1, bestT + span);
    for (const t of [left, (left + bestT) / 2, (bestT + right) / 2, right]) {
      const sample = cubicAt(p0, p1, p2, p3, t);
      const distance = Math.hypot(point.x - sample.x, point.y - sample.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestT = t;
      }
    }
    span /= 2;
  }
  return { t: bestT, distance: bestDistance };
}

function cubicAt(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function interior(t: number): boolean {
  return t > INSERT_POINT_MARGIN && t < 1 - INSERT_POINT_MARGIN;
}
