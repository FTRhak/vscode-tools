import { createId } from '../core/utils/create-id';
import {
  Anchor,
  Document,
  ObjectTransform,
  Segment,
  SourcePath,
  Style,
  Subpath,
  svgStrokeDefaults,
  Vec2,
  VectorObject,
} from './types';

const identityTransform: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
};

const penStyle: Style = {
  ...svgStrokeDefaults,
  fill: null,
  stroke: '#1a1a1a',
  strokeWidth: 4,
  fillRule: 'nonzero',
};

export interface PenObject {
  readonly document: Document;
  readonly objectId: string;
  readonly anchorId: string;
}

export interface PenPoint {
  readonly source: SourcePath;
  readonly anchorId: string;
}

export function beginPenObject(
  document: Document,
  position: Vec2,
  layerId?: string,
): PenObject | null {
  if (!finitePoint(position)) {
    return null;
  }
  const layer = penLayer(document, layerId);
  if (!layer || layer.locked || !layer.visible) {
    return null;
  }
  const objectId = createId();
  const anchorId = createId();
  const object: VectorObject = {
    id: objectId,
    name: nextPathName(document.objects),
    layerId: layer.id,
    visible: true,
    locked: false,
    kind: 'path',
    source: {
      subpaths: [
        {
          closed: false,
          anchors: [anchorAt(anchorId, position)],
          segments: [],
        },
      ],
    },
    style: penStyle,
    transform: identityTransform,
    modifiers: [],
  };
  return {
    document: { ...document, objects: [...document.objects, object] },
    objectId,
    anchorId,
  };
}

export function addPenPoint(source: SourcePath, position: Vec2): PenPoint | null {
  if (!finitePoint(position)) {
    return null;
  }
  const index = source.subpaths.length - 1;
  const subpath = source.subpaths[index];
  const previous = subpath?.anchors.at(-1);
  if (!subpath || subpath.closed || !previous) {
    return null;
  }
  const anchorId = createId();
  const segment: Segment = {
    id: createId(),
    kind: previous.handleOut ? 'cubic' : 'line',
    fromId: previous.id,
    toId: anchorId,
  };
  const next: Subpath = {
    ...subpath,
    anchors: [...subpath.anchors, anchorAt(anchorId, position)],
    segments: [...subpath.segments, segment],
  };
  const subpaths = source.subpaths.slice();
  subpaths[index] = next;
  return { source: { ...source, subpaths }, anchorId };
}

export function setPenHandles(
  source: SourcePath,
  anchorId: string,
  handleOut: Vec2,
  breakLink: boolean,
): SourcePath {
  if (!finitePoint(handleOut)) {
    return source;
  }
  let changed = false;
  const subpaths = source.subpaths.map((subpath) => {
    const index = subpath.anchors.findIndex((anchor) => anchor.id === anchorId);
    if (index < 0) {
      return subpath;
    }
    const anchor = subpath.anchors[index];
    const nextOut = { x: handleOut.x, y: handleOut.y };
    const nextIn = breakLink ? null : reflect(anchor.position, nextOut);
    const anchorChanged =
      !samePoint(anchor.handleOut, nextOut) || !samePoint(anchor.handleIn, nextIn);
    const segments = incomingSegments(subpath, anchorId, breakLink);
    if (!anchorChanged && segments === subpath.segments) {
      return subpath;
    }
    changed = true;
    const anchors = anchorChanged
      ? subpath.anchors.map((item, itemIndex) =>
          itemIndex === index ? { ...item, handleIn: nextIn, handleOut: nextOut } : item,
        )
      : subpath.anchors;
    return { ...subpath, anchors, segments };
  });
  return changed ? { ...source, subpaths } : source;
}

export function finishPen(source: SourcePath, closed: boolean): SourcePath {
  if (!closed) {
    return source;
  }
  const index = source.subpaths.length - 1;
  const subpath = source.subpaths[index];
  const first = subpath?.anchors[0];
  const last = subpath?.anchors.at(-1);
  if (!subpath || subpath.closed || !first || !last || subpath.anchors.length < 2) {
    return source;
  }
  const segment: Segment = {
    id: createId(),
    kind: last.handleOut || first.handleIn ? 'cubic' : 'line',
    fromId: last.id,
    toId: first.id,
  };
  const next: Subpath = {
    ...subpath,
    closed: true,
    segments: [...subpath.segments, segment],
  };
  const subpaths = source.subpaths.slice();
  subpaths[index] = next;
  return { ...source, subpaths };
}

function penLayer(document: Document, layerId: string | undefined) {
  if (layerId !== undefined) {
    return document.layers.find((layer) => layer.id === layerId);
  }
  return [...document.layers].sort((left, right) => left.order - right.order)[0];
}

function nextPathName(objects: readonly VectorObject[]): string {
  const names = new Set(objects.map((object) => object.name));
  if (!names.has('Path')) {
    return 'Path';
  }
  let index = 2;
  while (names.has(`Path ${index}`)) {
    index += 1;
  }
  return `Path ${index}`;
}

function anchorAt(id: string, position: Vec2): Anchor {
  return {
    id,
    position: { x: position.x, y: position.y },
    handleIn: null,
    handleOut: null,
  };
}

function incomingSegments(
  subpath: Subpath,
  anchorId: string,
  breakLink: boolean,
): readonly Segment[] {
  const index = subpath.segments.findIndex((segment) => segment.toId === anchorId);
  if (index < 0) {
    return subpath.segments;
  }
  const segment = subpath.segments[index];
  const previous = subpath.anchors.find((anchor) => anchor.id === segment.fromId);
  const kind: Segment['kind'] = !breakLink || previous?.handleOut ? 'cubic' : 'line';
  if (segment.kind === kind) {
    return subpath.segments;
  }
  return subpath.segments.map((item, itemIndex) =>
    itemIndex === index ? { ...item, kind } : item,
  );
}

function reflect(origin: Vec2, point: Vec2): Vec2 {
  return { x: origin.x * 2 - point.x, y: origin.y * 2 - point.y };
}

function samePoint(left: Vec2 | null, right: Vec2 | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.x === right.x && left.y === right.y;
}

function finitePoint(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
