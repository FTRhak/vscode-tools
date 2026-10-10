import { createId } from '../core/utils/create-id';
import { nextSeriesName } from './document-edits';
import {
  Anchor,
  Document,
  ObjectTransform,
  Segment,
  SourcePath,
  Style,
  svgStrokeDefaults,
  Vec2,
  VectorObject,
} from './types';

/** Four-cubic approximation of a circle or ellipse. */
export const ELLIPSE_KAPPA = 0.5522847498307936;

export const STAR_POINT_MIN = 3;
export const STAR_POINT_MAX = 32;
export const POLYGON_SIDE_MIN = 3;
export const POLYGON_SIDE_MAX = 64;

const MIN_EXTENT = 1e-6;

const identityTransform: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
};

const shapeStyle: Style = {
  ...svgStrokeDefaults,
  fill: '#c5d4f0',
  stroke: '#1a1a1a',
  strokeWidth: 4,
  fillRule: 'nonzero',
};

export type ShapeKind = 'rectangle' | 'ellipse' | 'star' | 'polygon' | 'rhombus';

export const SHAPE_NAMES: { readonly [K in ShapeKind]: string } = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  star: 'Star',
  polygon: 'Polygon',
  rhombus: 'Rhombus',
};

export interface ShapeDrag {
  readonly kind: ShapeKind;
  readonly origin: Vec2;
  readonly current: Vec2;
  readonly fromCenter: boolean;
  readonly constrain: boolean;
  readonly count: number;
  readonly innerRatio: number;
  readonly outerRadius: number | null;
  readonly innerRadius: number | null;
}

export interface ShapePlacement {
  readonly kind: ShapeKind;
  readonly origin: Vec2;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly innerRadius: number;
  readonly count: number;
}

export interface ShapeObjectResult {
  readonly document: Document;
  readonly objectId: string;
}

interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface DraftPoint {
  readonly position: Vec2;
  readonly handleIn?: Vec2 | null;
  readonly handleOut?: Vec2 | null;
}

export function isShapeKind(value: string): value is ShapeKind {
  return (
    value === 'rectangle' ||
    value === 'ellipse' ||
    value === 'star' ||
    value === 'polygon' ||
    value === 'rhombus'
  );
}

export function clampShapeCount(kind: ShapeKind, count: number): number {
  if (kind === 'star') {
    return clampInt(count, STAR_POINT_MIN, STAR_POINT_MAX, 5);
  }
  if (kind === 'polygon') {
    return clampInt(count, POLYGON_SIDE_MIN, POLYGON_SIDE_MAX, 6);
  }
  return count;
}

export function shapeSourceFromDrag(drag: ShapeDrag): SourcePath | null {
  if (!finitePoint(drag.origin) || !finitePoint(drag.current)) {
    return null;
  }
  if (drag.kind === 'star' || drag.kind === 'polygon') {
    return radialSource(drag);
  }
  const bounds = boundsFromDrag(drag.origin, drag.current, drag.fromCenter, drag.constrain);
  if (!bounds) {
    return null;
  }
  if (drag.kind === 'ellipse') {
    return ellipseSource(bounds);
  }
  if (drag.kind === 'rhombus') {
    return rhombusSource(bounds);
  }
  return rectangleSource(bounds);
}

export function shapeSource(placement: ShapePlacement): SourcePath | null {
  if (!finitePoint(placement.origin)) {
    return null;
  }
  if (placement.kind === 'polygon') {
    const sides = clampShapeCount('polygon', placement.count);
    return polygonSource(placement.origin, placement.radius, sides, flatBottomRotation(sides));
  }
  if (placement.kind === 'star') {
    const points = clampShapeCount('star', placement.count);
    return starSource(
      placement.origin,
      placement.radius,
      placement.innerRadius,
      points,
      -Math.PI / 2,
    );
  }
  const bounds = {
    x: placement.origin.x,
    y: placement.origin.y,
    width: placement.width,
    height: placement.height,
  };
  if (placement.kind === 'ellipse') {
    return ellipseSource(bounds);
  }
  if (placement.kind === 'rhombus') {
    return rhombusSource(bounds);
  }
  return rectangleSource(bounds);
}

export function addShape(
  document: Document,
  name: string,
  source: SourcePath,
  layerId?: string,
): ShapeObjectResult | null {
  const base = name.trim();
  if (!base || !closedShape(source)) {
    return null;
  }
  const layer = shapeLayer(document, layerId);
  if (!layer || layer.locked || !layer.visible) {
    return null;
  }
  const objectId = createId();
  const object: VectorObject = {
    id: objectId,
    name: nextSeriesName(
      document.objects.map((item) => item.name),
      base,
    ),
    layerId: layer.id,
    visible: true,
    locked: false,
    kind: 'path',
    source,
    style: shapeStyle,
    transform: { ...identityTransform },
    modifiers: [],
  };
  return {
    document: { ...document, objects: [...document.objects, object] },
    objectId,
  };
}

function radialSource(drag: ShapeDrag): SourcePath | null {
  const dx = drag.current.x - drag.origin.x;
  const dy = drag.current.y - drag.origin.y;
  const pointerRadius = Math.hypot(dx, dy);
  if (drag.kind === 'polygon') {
    const sides = clampShapeCount('polygon', drag.count);
    const rotation = drag.constrain ? flatBottomRotation(sides) : Math.atan2(dy, dx);
    return polygonSource(drag.origin, pointerRadius, sides, rotation);
  }
  const points = clampShapeCount('star', drag.count);
  const rotation = drag.constrain ? -Math.PI / 2 : Math.atan2(dy, dx);
  const outer = drag.outerRadius ?? pointerRadius;
  const ratio = clamp01(drag.innerRatio);
  const inner = drag.innerRadius ?? outer * ratio;
  return starSource(drag.origin, outer, inner, points, rotation);
}

function boundsFromDrag(
  origin: Vec2,
  current: Vec2,
  fromCenter: boolean,
  constrain: boolean,
): Bounds | null {
  let dx = current.x - origin.x;
  let dy = current.y - origin.y;
  if (constrain) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = signedSize(dx, size);
    dy = signedSize(dy, size);
  }
  if (fromCenter) {
    const width = Math.abs(dx) * 2;
    const height = Math.abs(dy) * 2;
    if (width <= MIN_EXTENT || height <= MIN_EXTENT) {
      return null;
    }
    return {
      x: origin.x - width / 2,
      y: origin.y - height / 2,
      width,
      height,
    };
  }
  const width = Math.abs(dx);
  const height = Math.abs(dy);
  if (width <= MIN_EXTENT || height <= MIN_EXTENT) {
    return null;
  }
  return {
    x: Math.min(origin.x, origin.x + dx),
    y: Math.min(origin.y, origin.y + dy),
    width,
    height,
  };
}

function rectangleSource(bounds: Bounds): SourcePath | null {
  if (bounds.width <= MIN_EXTENT || bounds.height <= MIN_EXTENT) {
    return null;
  }
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return closedPath(
    [
      { position: { x: bounds.x, y: bounds.y } },
      { position: { x: right, y: bounds.y } },
      { position: { x: right, y: bottom } },
      { position: { x: bounds.x, y: bottom } },
    ],
    'line',
  );
}

function ellipseSource(bounds: Bounds): SourcePath | null {
  if (bounds.width <= MIN_EXTENT || bounds.height <= MIN_EXTENT) {
    return null;
  }
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  const kx = ELLIPSE_KAPPA * rx;
  const ky = ELLIPSE_KAPPA * ry;
  return closedPath(
    [
      {
        position: { x: cx + rx, y: cy },
        handleIn: { x: cx + rx, y: cy - ky },
        handleOut: { x: cx + rx, y: cy + ky },
      },
      {
        position: { x: cx, y: cy + ry },
        handleIn: { x: cx + kx, y: cy + ry },
        handleOut: { x: cx - kx, y: cy + ry },
      },
      {
        position: { x: cx - rx, y: cy },
        handleIn: { x: cx - rx, y: cy + ky },
        handleOut: { x: cx - rx, y: cy - ky },
      },
      {
        position: { x: cx, y: cy - ry },
        handleIn: { x: cx - kx, y: cy - ry },
        handleOut: { x: cx + kx, y: cy - ry },
      },
    ],
    'cubic',
  );
}

function rhombusSource(bounds: Bounds): SourcePath | null {
  if (bounds.width <= MIN_EXTENT || bounds.height <= MIN_EXTENT) {
    return null;
  }
  const midX = bounds.x + bounds.width / 2;
  const midY = bounds.y + bounds.height / 2;
  return closedPath(
    [
      { position: { x: midX, y: bounds.y } },
      { position: { x: bounds.x + bounds.width, y: midY } },
      { position: { x: midX, y: bounds.y + bounds.height } },
      { position: { x: bounds.x, y: midY } },
    ],
    'line',
  );
}

function polygonSource(
  center: Vec2,
  radius: number,
  sides: number,
  rotation: number,
): SourcePath | null {
  if (radius <= MIN_EXTENT || !Number.isFinite(rotation)) {
    return null;
  }
  const points: DraftPoint[] = [];
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index * 2 * Math.PI) / sides;
    points.push({
      position: {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      },
    });
  }
  return closedPath(points, 'line');
}

function starSource(
  center: Vec2,
  outer: number,
  inner: number,
  points: number,
  rotation: number,
): SourcePath | null {
  if (outer <= MIN_EXTENT || !Number.isFinite(inner) || !Number.isFinite(rotation)) {
    return null;
  }
  const innerRadius = Math.min(Math.max(inner, 0), outer);
  const vertices: DraftPoint[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : innerRadius;
    const angle = rotation + (index * Math.PI) / points;
    vertices.push({
      position: {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      },
    });
  }
  return closedPath(vertices, 'line');
}

/** Puts the midpoint of one side straight down, so that side lies horizontal. */
function flatBottomRotation(sides: number): number {
  return Math.PI / 2 - Math.PI / sides;
}

function closedPath(points: readonly DraftPoint[], kind: 'line' | 'cubic'): SourcePath {
  const anchors: Anchor[] = points.map((point) => ({
    id: createId(),
    position: { x: point.position.x, y: point.position.y },
    handleIn: copyPoint(point.handleIn),
    handleOut: copyPoint(point.handleOut),
  }));
  const segments: Segment[] = anchors.map((anchor, index) => {
    const next = anchors[(index + 1) % anchors.length];
    return {
      id: createId(),
      kind,
      fromId: anchor.id,
      toId: next.id,
    };
  });
  return {
    subpaths: [{ closed: true, anchors, segments }],
  };
}

function closedShape(source: SourcePath): boolean {
  const subpath = source.subpaths[0];
  return (
    source.subpaths.length === 1 &&
    !!subpath &&
    subpath.closed &&
    subpath.anchors.length >= 3 &&
    subpath.segments.length >= 3
  );
}

function shapeLayer(document: Document, layerId: string | undefined) {
  if (layerId !== undefined) {
    return document.layers.find((layer) => layer.id === layerId);
  }
  return [...document.layers].sort((left, right) => left.order - right.order)[0];
}

function signedSize(delta: number, size: number): number {
  if (delta < 0) {
    return -size;
  }
  if (delta > 0) {
    return size;
  }
  return size;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

function copyPoint(point: Vec2 | null | undefined): Vec2 | null {
  return point ? { x: point.x, y: point.y } : null;
}

function finitePoint(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
