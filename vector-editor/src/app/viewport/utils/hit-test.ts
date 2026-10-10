import { ClipperHold, EvaluatedGeometry, evaluateDocument } from '@vector-editor/modules/eval';
import { isEmptyPoint } from '@vector-editor/modules/object-empty-point';
import { isImage } from '@vector-editor/modules/object-image';
import { objectsInPaintOrder } from '@vector-editor/modules/paint-order';
import {
  Document,
  ObjectTransform,
  SourcePath,
  Subpath,
  Vec2,
  VectorObject,
} from '@vector-editor/modules/types';
import { effectiveStrokeAlign } from './scene';

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
const EMPTY_POINT_HIT_PX = 8;

export function hitTestObject(
  document: Document,
  point: Vec2,
  zoom: number,
  hold: ClipperHold | null = null,
): string | null {
  const geometry = geometryById(document, hold);
  const objects = objectsInPaintOrder(document);
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isEmptyPoint(object)) {
      const radius = EMPTY_POINT_HIT_PX / (zoom || 1);
      const dx = point.x - object.transform.x;
      const dy = point.y - object.transform.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return object.id;
      }
      continue;
    }
    if (isImage(object)) {
      const local = documentToLocal(object.transform, point);
      if (local && hitsImage(object, local)) {
        return object.id;
      }
      continue;
    }
    const local = documentToLocal(object.transform, point);
    if (!local) {
      continue;
    }
    if (hitsObject(object, local, zoom, geometry.get(object.id))) {
      return object.id;
    }
  }
  return null;
}

export function objectsInRect(
  document: Document,
  rect: DocumentRect,
  hold: ClipperHold | null = null,
): readonly string[] {
  const geometry = geometryById(document, hold);
  const box = normalizeRect(rect);
  const hits: string[] = [];
  for (const object of objectsInPaintOrder(document)) {
    if (isEmptyPoint(object)) {
      const { x, y } = object.transform;
      if (intersects({ minX: x, minY: y, maxX: x, maxY: y }, box)) {
        hits.push(object.id);
      }
      continue;
    }
    if (isImage(object)) {
      const bounds = imageBounds(object);
      if (bounds && intersects(bounds, box)) {
        hits.push(object.id);
      }
      continue;
    }
    const bounds = objectBounds(object, geometry.get(object.id));
    if (bounds && intersects(bounds, box)) {
      hits.push(object.id);
    }
  }
  return hits;
}

function hitsImage(object: VectorObject, point: Vec2): boolean {
  const image = object.image;
  if (!image) {
    return false;
  }
  return point.x >= 0 && point.y >= 0 && point.x <= image.width && point.y <= image.height;
}

function imageBounds(object: VectorObject): Bounds | null {
  const image = object.image;
  if (!image) {
    return null;
  }
  const corners = [
    { x: 0, y: 0 },
    { x: image.width, y: 0 },
    { x: image.width, y: image.height },
    { x: 0, y: image.height },
  ].map((point) => localToDocument(object.transform, point));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of corners) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function geometryById(
  document: Document,
  hold: ClipperHold | null,
): Map<string, EvaluatedGeometry> {
  return new Map(evaluateDocument(document.objects, hold).map((item) => [item.objectId, item]));
}

function hitsObject(
  object: VectorObject,
  point: Vec2,
  zoom: number,
  geometry: EvaluatedGeometry | undefined,
): boolean {
  const tolerance = localTolerance(zoom, object.transform);
  const subpaths = geometry?.subpaths ?? [];
  const align = effectiveStrokeAlign(object.style, subpaths);
  const strokeActive = object.style.stroke !== null && object.style.strokeWidth > 0;
  const radius = !strokeActive
    ? 0
    : align === 'default'
      ? object.style.strokeWidth / 2
      : object.style.strokeWidth;
  const fillRule = geometry?.fillRule ?? object.style.fillRule;
  let crossings = 0;
  let winding = 0;
  let nearest = Infinity;

  for (const subpath of subpaths) {
    const points = flattenSubpath(subpath, tolerance);
    if (points.length === 0) {
      continue;
    }
    if (radius > 0) {
      const distance = distanceToPolyline(point, points);
      if (align === 'default' && distance <= radius) {
        return true;
      }
      nearest = Math.min(nearest, distance);
    }
    if (object.style.fill !== null || align !== 'default') {
      const ring = openRing(points);
      const hit = rayCrossings(point, ring);
      crossings += hit.count;
      winding += hit.winding;
    }
  }

  const inside = fillRule === 'evenodd' ? crossings % 2 === 1 : winding !== 0;
  if (object.style.fill !== null && inside) {
    return true;
  }
  if (!strokeActive || align === 'default' || nearest > radius) {
    return false;
  }
  return align === 'inside' ? inside : !inside;
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

function objectBounds(
  object: VectorObject,
  geometry: EvaluatedGeometry | undefined,
): Bounds | null {
  const points = controlPoints({ subpaths: geometry?.subpaths ?? [] }).map((point) =>
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
  const subpaths = geometry?.subpaths ?? object.source.subpaths;
  const align = effectiveStrokeAlign(object.style, subpaths);
  const factor = align === 'outside' ? 1 : align === 'inside' ? 0 : 0.5;
  const pad =
    object.style.stroke !== null && object.style.strokeWidth > 0
      ? object.style.strokeWidth *
        factor *
        Math.max(Math.abs(object.transform.scaleX), Math.abs(object.transform.scaleY))
      : 0;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
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
  const dx = point.x - transform.x - transform.originX * transform.scaleX;
  const dy = point.y - transform.y - transform.originY * transform.scaleY;
  const radians = (-transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: transform.originX + (dx * cos - dy * sin) / transform.scaleX,
    y: transform.originY + (dx * sin + dy * cos) / transform.scaleY,
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
  const dx = (point.x - transform.originX) * transform.scaleX;
  const dy = (point.y - transform.originY) * transform.scaleY;
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: transform.x + transform.originX * transform.scaleX + dx * cos - dy * sin,
    y: transform.y + transform.originY * transform.scaleY + dx * sin + dy * cos,
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
