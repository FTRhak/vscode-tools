import {
  Document,
  evaluateObject,
  objectsInPaintOrder,
  ObjectTransform,
  SourcePath,
  Subpath,
  Vec2,
  VectorObject,
} from '@vector-editor/core';

export interface DocumentRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const MAX_FLATTEN_DEPTH = 12;
const SCREEN_TOLERANCE = 0.75;

export function hitTestObject(document: Document, point: Vec2, zoom: number): string | null {
  const objects = objectsInPaintOrder(document);
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    const local = documentToLocal(object.transform, point);
    if (!local) {
      continue;
    }
    if (hitsObject(object, local, zoom)) {
      return object.id;
    }
  }
  return null;
}

export function objectsInRect(document: Document, rect: DocumentRect): readonly string[] {
  const box = normalizeRect(rect);
  const hits: string[] = [];
  for (const object of objectsInPaintOrder(document)) {
    const bounds = objectBounds(object);
    if (bounds && intersects(bounds, box)) {
      hits.push(object.id);
    }
  }
  return hits;
}

function hitsObject(object: VectorObject, point: Vec2, zoom: number): boolean {
  const tolerance = localTolerance(zoom, object.transform);
  const radius =
    object.style.stroke !== null && object.style.strokeWidth > 0 ? object.style.strokeWidth / 2 : 0;
  let crossings = 0;
  let winding = 0;

  for (const subpath of displayedSource(object).subpaths) {
    const points = flattenSubpath(subpath, tolerance);
    if (points.length === 0) {
      continue;
    }
    if (radius > 0 && distanceToPolyline(point, points) <= radius) {
      return true;
    }
    if (object.style.fill !== null) {
      const ring = openRing(points);
      const hit = rayCrossings(point, ring);
      crossings += hit.count;
      winding += hit.winding;
    }
  }

  if (object.style.fill === null) {
    return false;
  }
  return object.style.fillRule === 'evenodd' ? crossings % 2 === 1 : winding !== 0;
}

function localTolerance(zoom: number, transform: ObjectTransform): number {
  const scale = Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
  const pixelsPerUnit = zoom * scale;
  if (pixelsPerUnit <= 0) {
    return SCREEN_TOLERANCE;
  }
  return SCREEN_TOLERANCE / pixelsPerUnit;
}

function flattenSubpath(subpath: Subpath, tolerance: number): Vec2[] {
  const anchors = new Map(subpath.anchors.map((anchor) => [anchor.id, anchor]));
  const points: Vec2[] = [];

  for (const segment of subpath.segments) {
    const from = anchors.get(segment.fromId);
    const to = anchors.get(segment.toId);
    if (!from || !to) {
      continue;
    }
    if (points.length === 0) {
      points.push(from.position);
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
      tolerance,
      0,
      points,
    );
  }

  return points;
}

function flattenCubic(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  tolerance: number,
  depth: number,
  out: Vec2[],
): void {
  if (depth >= MAX_FLATTEN_DEPTH || isFlat(p0, p1, p2, p3, tolerance)) {
    out.push(p3);
    return;
  }
  const p01 = mix(p0, p1);
  const p12 = mix(p1, p2);
  const p23 = mix(p2, p3);
  const p012 = mix(p01, p12);
  const p123 = mix(p12, p23);
  const p0123 = mix(p012, p123);
  flattenCubic(p0, p01, p012, p0123, tolerance, depth + 1, out);
  flattenCubic(p0123, p123, p23, p3, tolerance, depth + 1, out);
}

function isFlat(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, tolerance: number): boolean {
  return distanceToLine(p1, p0, p3) <= tolerance && distanceToLine(p2, p0, p3) <= tolerance;
}

function openRing(points: readonly Vec2[]): Vec2[] {
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) {
    return points.slice(0, -1);
  }
  return [...points];
}

function rayCrossings(
  point: Vec2,
  ring: readonly Vec2[],
): { readonly count: number; readonly winding: number } {
  let count = 0;
  let winding = 0;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const start = ring[previous];
    const end = ring[index];
    if (start.y === end.y) {
      continue;
    }
    const straddles = start.y > point.y !== end.y > point.y;
    if (!straddles) {
      continue;
    }
    const x = start.x + ((point.y - start.y) / (end.y - start.y)) * (end.x - start.x);
    if (x < point.x) {
      continue;
    }
    count += 1;
    winding += end.y > start.y ? 1 : -1;
  }
  return { count, winding };
}

function objectBounds(object: VectorObject): Bounds | null {
  const points = controlPoints(displayedSource(object)).map((point) =>
    localToDocument(object.transform, point),
  );
  if (points.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const pad =
    object.style.stroke !== null && object.style.strokeWidth > 0
      ? (object.style.strokeWidth / 2) *
        Math.max(Math.abs(object.transform.scaleX), Math.abs(object.transform.scaleY))
      : 0;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function displayedSource(object: VectorObject): SourcePath {
  return { subpaths: evaluateObject(object).subpaths };
}

function controlPoints(source: SourcePath): Vec2[] {
  const points: Vec2[] = [];
  for (const subpath of source.subpaths) {
    for (const anchor of subpath.anchors) {
      points.push(anchor.position);
      if (anchor.handleIn) {
        points.push(anchor.handleIn);
      }
      if (anchor.handleOut) {
        points.push(anchor.handleOut);
      }
    }
  }
  return points;
}

function normalizeRect(rect: DocumentRect): Bounds {
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  return {
    minX: Math.min(rect.x, x2),
    minY: Math.min(rect.y, y2),
    maxX: Math.max(rect.x, x2),
    maxY: Math.max(rect.y, y2),
  };
}

function intersects(left: Bounds, right: Bounds): boolean {
  return (
    left.minX <= right.maxX &&
    left.maxX >= right.minX &&
    left.minY <= right.maxY &&
    left.maxY >= right.minY
  );
}

export function documentToLocal(transform: ObjectTransform, point: Vec2): Vec2 | null {
  if (transform.scaleX === 0 || transform.scaleY === 0) {
    return null;
  }
  const dx = point.x - transform.x;
  const dy = point.y - transform.y;
  const radians = (-transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: (dx * cos - dy * sin) / transform.scaleX,
    y: (dx * sin + dy * cos) / transform.scaleY,
  };
}

export function documentDeltaToLocal(
  transform: ObjectTransform,
  dx: number,
  dy: number,
): Vec2 | null {
  const origin = documentToLocal(transform, { x: transform.x, y: transform.y });
  const next = documentToLocal(transform, { x: transform.x + dx, y: transform.y + dy });
  if (!origin || !next) {
    return null;
  }
  return { x: next.x - origin.x, y: next.y - origin.y };
}

export function localToDocument(transform: ObjectTransform, point: Vec2): Vec2 {
  const scaledX = point.x * transform.scaleX;
  const scaledY = point.y * transform.scaleY;
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: transform.x + scaledX * cos - scaledY * sin,
    y: transform.y + scaledX * sin + scaledY * cos,
  };
}

function distanceToPolyline(point: Vec2, points: readonly Vec2[]): number {
  let best = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    best = Math.min(best, distanceToSegment(point, points[index - 1], points[index]));
  }
  return best;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function distanceToLine(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  return Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) / length;
}

function mix(start: Vec2, end: Vec2): Vec2 {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function samePoint(start: Vec2, end: Vec2): boolean {
  return Math.abs(start.x - end.x) <= 1e-9 && Math.abs(start.y - end.y) <= 1e-9;
}
