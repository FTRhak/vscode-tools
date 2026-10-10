import { type Path64, type Paths64 } from 'clipper2-ts';
import { SourcePath, Subpath, Vec2 } from '@vector-editor/modules/types/types';
import { replicaId } from './copy-subpath';

export const CLIPPER_SCALE = 1000;
export const FLATTEN_TOLERANCE = 0.25;

const MAX_FLATTEN_DEPTH = 16;

export interface FlatPath {
  readonly closed: boolean;
  readonly points: Path64;
}

export function flattenSource(source: SourcePath): FlatPath[] {
  return source.subpaths.flatMap((subpath) => {
    const points = scalePoints(collectPoints(subpath));
    if (points.length === 0) {
      return [];
    }
    return [{ closed: subpath.closed, points }];
  });
}

export function sourceFromPaths(paths: Paths64, modifierId: string): SourcePath {
  const subpaths: Subpath[] = [];
  let vertex = 0;
  let edge = 0;

  for (const path of paths) {
    const points = uniqueRing(path);
    if (points.length < 3) {
      continue;
    }
    const anchors = points.map((point) => ({
      id: replicaId('v', modifierId, String(vertex++)),
      position: { x: point.x / CLIPPER_SCALE, y: point.y / CLIPPER_SCALE },
      handleIn: null,
      handleOut: null,
    }));
    const segments = anchors.map((anchor, index) => {
      const next = anchors[(index + 1) % anchors.length];
      return {
        id: replicaId('e', modifierId, String(edge++)),
        kind: 'line' as const,
        fromId: anchor.id,
        toId: next.id,
      };
    });
    subpaths.push({ closed: true, anchors, segments });
  }

  return { subpaths };
}

export function collectPoints(subpath: Subpath): Vec2[] {
  const anchors = new Map(subpath.anchors.map((anchor) => [anchor.id, anchor]));
  const first = subpath.segments[0] ? anchors.get(subpath.segments[0].fromId) : subpath.anchors[0];
  if (!first) {
    return [];
  }
  const points: Vec2[] = [first.position];
  for (const segment of subpath.segments) {
    const from = anchors.get(segment.fromId);
    const to = anchors.get(segment.toId);
    if (!from || !to) {
      continue;
    }
    if (segment.kind === 'line') {
      points.push(to.position);
      continue;
    }
    flattenCubic(
      from.position,
      from.handleOut ?? from.position,
      to.handleIn ?? to.position,
      to.position,
      points,
      0,
    );
  }
  if (subpath.closed && points.length > 1 && samePoint(points[0], points[points.length - 1])) {
    points.pop();
  }
  return points;
}

function flattenCubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, points: Vec2[], depth: number): void {
  if (depth >= MAX_FLATTEN_DEPTH || isFlat(p0, p1, p2, p3)) {
    points.push(p3);
    return;
  }
  const p01 = midpoint(p0, p1);
  const p12 = midpoint(p1, p2);
  const p23 = midpoint(p2, p3);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const bend = midpoint(p012, p123);
  flattenCubic(p0, p01, p012, bend, points, depth + 1);
  flattenCubic(bend, p123, p23, p3, points, depth + 1);
}

function isFlat(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): boolean {
  return (
    distanceToSegment(p1, p0, p3) <= FLATTEN_TOLERANCE &&
    distanceToSegment(p2, p0, p3) <= FLATTEN_TOLERANCE
  );
}

function scalePoints(points: readonly Vec2[]): Path64 {
  const scaled: Path64 = [];
  for (const point of points) {
    const next = {
      x: Math.round(point.x * CLIPPER_SCALE),
      y: Math.round(point.y * CLIPPER_SCALE),
    };
    const last = scaled[scaled.length - 1];
    if (last && last.x === next.x && last.y === next.y) {
      continue;
    }
    scaled.push(next);
  }
  return scaled;
}

function uniqueRing(path: Path64): Path64 {
  const points: Path64 = [];
  for (const point of path) {
    const next = { x: point.x, y: point.y };
    const last = points[points.length - 1];
    if (last && last.x === next.x && last.y === next.y) {
      continue;
    }
    points.push(next);
  }
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first && last && first.x === last.x && first.y === last.y) {
      points.pop();
    }
  }
  return points;
}

function midpoint(start: Vec2, end: Vec2): Vec2 {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function samePoint(start: Vec2 | undefined, end: Vec2 | undefined): boolean {
  return !!start && !!end && start.x === end.x && start.y === end.y;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
