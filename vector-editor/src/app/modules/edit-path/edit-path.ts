import { createId } from '@vector-editor/core/utils';
import { Anchor, Segment, SourcePath, Subpath, Vec2 } from '../types';

export type HandleSlot = 'in' | 'out';

export function translateAnchors(source: SourcePath, ids: readonly string[], dx: number, dy: number): SourcePath {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
    return source;
  }
  return mapAnchors(source, ids, (anchor) => shiftAnchor(anchor, dx, dy));
}

export function setAnchorPosition(source: SourcePath, ids: readonly string[], position: Partial<Vec2>): SourcePath {
  if (!validPartial(position)) {
    return source;
  }
  return mapAnchors(source, ids, (anchor) => {
    const x = position.x ?? anchor.position.x;
    const y = position.y ?? anchor.position.y;
    return shiftAnchor(anchor, x - anchor.position.x, y - anchor.position.y);
  });
}

export type AnchorPointType = 'corner' | 'smooth' | 'symmetric' | 'line';

const HANDLE_EPSILON = 1e-6;
const COLLINEAR_TOLERANCE = 0.02;
const SMOOTH_LENGTH_RATIO = 0.75;
const HANDLE_LENGTH_FRACTION = 1 / 3;
const FALLBACK_HANDLE_LENGTH = 32;

export function anchorPointType(anchor: Anchor): AnchorPointType {
  const inward = handleOffset(anchor.position, anchor.handleIn);
  const outward = handleOffset(anchor.position, anchor.handleOut);
  if (!inward && !outward) {
    return 'line';
  }
  if (!inward || !outward) {
    return 'corner';
  }
  const inLength = Math.hypot(inward.x, inward.y);
  const outLength = Math.hypot(outward.x, outward.y);
  const scale = inLength * outLength;
  const cross = inward.x * outward.y - inward.y * outward.x;
  const dot = inward.x * outward.x + inward.y * outward.y;
  if (Math.abs(cross) > COLLINEAR_TOLERANCE * scale || dot >= 0) {
    return 'corner';
  }
  return nearlyEqualLength(inLength, outLength) ? 'symmetric' : 'smooth';
}

export function setAnchorPointType(source: SourcePath, ids: readonly string[], pointType: AnchorPointType): SourcePath {
  if (ids.length === 0) {
    return source;
  }
  const wanted = new Set(ids);
  let changed = false;
  const subpaths = source.subpaths.map((subpath) => {
    const changedIds = new Set<string>();
    const anchors = subpath.anchors.map((anchor, index) => {
      if (!wanted.has(anchor.id)) {
        return anchor;
      }
      const next = convertAnchor(anchor, neighborAnchor(subpath, index, -1), neighborAnchor(subpath, index, 1), pointType);
      if (next !== anchor) {
        changedIds.add(anchor.id);
      }
      return next;
    });
    if (changedIds.size === 0) {
      return subpath;
    }
    changed = true;
    return withSegmentKinds({ ...subpath, anchors }, changedIds);
  });
  return changed ? { ...source, subpaths } : source;
}

export function setAnchorHandle(
  source: SourcePath,
  ids: readonly string[],
  slot: HandleSlot,
  position: Partial<Vec2>,
  breakLink: boolean,
): SourcePath {
  if (position.x === undefined && position.y === undefined) {
    return source;
  }
  if ((position.x !== undefined && !Number.isFinite(position.x)) || (position.y !== undefined && !Number.isFinite(position.y))) {
    return source;
  }
  return mapAnchors(source, ids, (anchor) => withHandle(anchor, slot, position, breakLink));
}

export const INSERT_POINT_MARGIN = 1e-4;

export interface InsertedPoint {
  readonly source: SourcePath;
  readonly anchorId: string;
}

export function insertPoint(source: SourcePath, segmentId: string, t: number): InsertedPoint | null {
  if (!Number.isFinite(t) || t <= INSERT_POINT_MARGIN || t >= 1 - INSERT_POINT_MARGIN) {
    return null;
  }
  for (let index = 0; index < source.subpaths.length; index += 1) {
    const subpath = source.subpaths[index];
    const segmentIndex = subpath.segments.findIndex((segment) => segment.id === segmentId);
    if (segmentIndex < 0) {
      continue;
    }
    const inserted = insertOnSubpath(subpath, segmentIndex, t);
    if (!inserted) {
      return null;
    }
    const subpaths = source.subpaths.slice();
    subpaths[index] = inserted.subpath;
    return { source: { ...source, subpaths }, anchorId: inserted.anchorId };
  }
  return null;
}

export function deleteAnchors(source: SourcePath, ids: readonly string[]): SourcePath {
  if (ids.length === 0) {
    return source;
  }
  const remove = new Set(ids);
  let changed = false;
  const subpaths: Subpath[] = [];
  for (const subpath of source.subpaths) {
    if (!subpath.anchors.some((anchor) => remove.has(anchor.id))) {
      subpaths.push(subpath);
      continue;
    }
    changed = true;
    const next = withoutAnchors(subpath, remove);
    if (next) {
      subpaths.push(next);
    }
  }
  return changed ? { ...source, subpaths } : source;
}

function mapAnchors(source: SourcePath, ids: readonly string[], update: (anchor: Anchor) => Anchor): SourcePath {
  if (ids.length === 0) {
    return source;
  }
  const wanted = new Set(ids);
  let changed = false;
  const subpaths = source.subpaths.map((subpath) => {
    let subpathChanged = false;
    const anchors = subpath.anchors.map((anchor) => {
      if (!wanted.has(anchor.id)) {
        return anchor;
      }
      const next = update(anchor);
      if (next !== anchor) {
        subpathChanged = true;
      }
      return next;
    });
    if (!subpathChanged) {
      return subpath;
    }
    changed = true;
    return { ...subpath, anchors };
  });
  return changed ? { ...source, subpaths } : source;
}

function shiftAnchor(anchor: Anchor, dx: number, dy: number): Anchor {
  if (dx === 0 && dy === 0) {
    return anchor;
  }
  return {
    ...anchor,
    position: translate(anchor.position, dx, dy),
    handleIn: anchor.handleIn ? translate(anchor.handleIn, dx, dy) : null,
    handleOut: anchor.handleOut ? translate(anchor.handleOut, dx, dy) : null,
  };
}

function withHandle(anchor: Anchor, slot: HandleSlot, position: Partial<Vec2>, breakLink: boolean): Anchor {
  const current = handleOf(anchor, slot);
  const next = resolveHandle(current, position);
  if (!next) {
    return anchor;
  }
  const oppositeSlot: HandleSlot = slot === 'in' ? 'out' : 'in';
  const opposite = handleOf(anchor, oppositeSlot);
  const mirrored =
    !breakLink && opposite
      ? {
          x: 2 * anchor.position.x - next.x,
          y: 2 * anchor.position.y - next.y,
        }
      : opposite;
  if (samePoint(current, next) && samePoint(opposite, mirrored)) {
    return anchor;
  }
  return slot === 'in' ? { ...anchor, handleIn: next, handleOut: mirrored } : { ...anchor, handleIn: mirrored, handleOut: next };
}

function resolveHandle(current: Vec2 | null, position: Partial<Vec2>): Vec2 | null {
  if (!current) {
    if (position.x === undefined || position.y === undefined) {
      return null;
    }
    return { x: position.x, y: position.y };
  }
  return {
    x: position.x ?? current.x,
    y: position.y ?? current.y,
  };
}

function withoutAnchors(subpath: Subpath, remove: ReadonlySet<string>): Subpath | null {
  const anchors = subpath.anchors.filter((anchor) => !remove.has(anchor.id));
  if (anchors.length === 0) {
    return null;
  }
  if (anchors.length === 1) {
    return { closed: false, anchors, segments: [] };
  }
  const pairCount = subpath.closed ? anchors.length : anchors.length - 1;
  const segments: Segment[] = [];
  for (let index = 0; index < pairCount; index += 1) {
    const from = anchors[index];
    const to = anchors[(index + 1) % anchors.length];
    const existing = subpath.segments.find((segment) => segment.fromId === from.id && segment.toId === to.id);
    if (existing) {
      segments.push(existing);
      continue;
    }
    segments.push({
      id: createId(),
      kind: bridgeKind(subpath, from.id, to.id),
      fromId: from.id,
      toId: to.id,
    });
  }
  return { closed: subpath.closed, anchors, segments };
}

function bridgeKind(subpath: Subpath, fromId: string, toId: string): Segment['kind'] {
  const ids = subpath.anchors.map((anchor) => anchor.id);
  const start = ids.indexOf(fromId);
  if (start < 0) {
    return 'line';
  }
  let cubic = false;
  let index = start;
  for (let step = 0; step < ids.length; step += 1) {
    const next = index + 1;
    if (!subpath.closed && next >= ids.length) {
      break;
    }
    const nextIndex = next % ids.length;
    const segment = subpath.segments.find((item) => item.fromId === ids[index] && item.toId === ids[nextIndex]);
    if (segment?.kind === 'cubic') {
      cubic = true;
    }
    if (ids[nextIndex] === toId) {
      break;
    }
    index = nextIndex;
  }
  return cubic ? 'cubic' : 'line';
}

function handleOf(anchor: Anchor, slot: HandleSlot): Vec2 | null {
  return slot === 'in' ? anchor.handleIn : anchor.handleOut;
}

function translate(point: Vec2, dx: number, dy: number): Vec2 {
  return { x: point.x + dx, y: point.y + dy };
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

function insertOnSubpath(
  subpath: Subpath,
  segmentIndex: number,
  t: number,
): { readonly subpath: Subpath; readonly anchorId: string } | null {
  const segment = subpath.segments[segmentIndex];
  if (!segment) {
    return null;
  }
  const fromIndex = subpath.anchors.findIndex((anchor) => anchor.id === segment.fromId);
  const toIndex = subpath.anchors.findIndex((anchor) => anchor.id === segment.toId);
  const from = fromIndex < 0 ? undefined : subpath.anchors[fromIndex];
  const to = toIndex < 0 ? undefined : subpath.anchors[toIndex];
  if (!from || !to || from.id === to.id) {
    return null;
  }
  const split = segment.kind === 'line' ? splitLine(from, to, t) : splitCubic(from, to, t);
  const anchorId = createId();
  const anchors = subpath.anchors.slice();
  anchors[fromIndex] = split.from;
  anchors[toIndex] = split.to;
  anchors.splice(fromIndex + 1, 0, {
    id: anchorId,
    position: split.position,
    handleIn: split.handleIn,
    handleOut: split.handleOut,
  });
  const segments = subpath.segments.slice();
  segments.splice(
    segmentIndex,
    1,
    { id: createId(), kind: segment.kind, fromId: from.id, toId: anchorId },
    { id: createId(), kind: segment.kind, fromId: anchorId, toId: to.id },
  );
  return {
    subpath: { ...subpath, anchors, segments },
    anchorId,
  };
}

function splitLine(
  from: Anchor,
  to: Anchor,
  t: number,
): {
  readonly from: Anchor;
  readonly to: Anchor;
  readonly position: Vec2;
  readonly handleIn: Vec2 | null;
  readonly handleOut: Vec2 | null;
} {
  return {
    from,
    to,
    position: lerp(from.position, to.position, t),
    handleIn: null,
    handleOut: null,
  };
}

function splitCubic(
  from: Anchor,
  to: Anchor,
  t: number,
): {
  readonly from: Anchor;
  readonly to: Anchor;
  readonly position: Vec2;
  readonly handleIn: Vec2 | null;
  readonly handleOut: Vec2 | null;
} {
  const p0 = from.position;
  const p1 = from.handleOut ?? from.position;
  const p2 = to.handleIn ?? to.position;
  const p3 = to.position;
  const p01 = lerp(p0, p1, t);
  const p12 = lerp(p1, p2, t);
  const p23 = lerp(p2, p3, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const position = lerp(p012, p123, t);
  return {
    from: { ...from, handleOut: p01 },
    to: { ...to, handleIn: p23 },
    position,
    handleIn: p012,
    handleOut: p123,
  };
}

function lerp(start: Vec2, end: Vec2, t: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function convertAnchor(anchor: Anchor, previous: Anchor | undefined, next: Anchor | undefined, pointType: AnchorPointType): Anchor {
  if (pointType === 'line') {
    return withHandles(anchor, null, null);
  }
  if (anchorPointType(anchor) === pointType) {
    return anchor;
  }
  const frame = handleFrame(anchor, previous, next);
  switch (pointType) {
    case 'corner':
      return toCorner(anchor, frame);
    case 'smooth':
      return toSmooth(anchor, frame);
    case 'symmetric':
      return toSymmetric(anchor, frame);
  }
}

function toCorner(anchor: Anchor, frame: HandleFrame): Anchor {
  const outward = handleOffset(anchor.position, anchor.handleOut);
  const inward = handleOffset(anchor.position, anchor.handleIn);
  if (outward && inward) {
    return withHandles(anchor, anchor.handleIn, {
      x: anchor.position.x - outward.y,
      y: anchor.position.y + outward.x,
    });
  }
  return withHandles(anchor, null, pointOnAxis(anchor.position, frame.axis, frame.lengthOut));
}

function toSmooth(anchor: Anchor, frame: HandleFrame): Anchor {
  let lengthIn = frame.lengthIn > HANDLE_EPSILON ? frame.lengthIn : frame.lengthOut * SMOOTH_LENGTH_RATIO;
  let lengthOut = frame.lengthOut > HANDLE_EPSILON ? frame.lengthOut : lengthIn * SMOOTH_LENGTH_RATIO;
  if (nearlyEqualLength(lengthIn, lengthOut)) {
    lengthOut = lengthIn * SMOOTH_LENGTH_RATIO;
  }
  return placeHandles(anchor, frame.axis, lengthIn, lengthOut);
}

function toSymmetric(anchor: Anchor, frame: HandleFrame): Anchor {
  const length = Math.max(frame.lengthIn, frame.lengthOut);
  return placeHandles(anchor, frame.axis, length, length);
}

interface HandleFrame {
  readonly axis: Vec2;
  readonly lengthIn: number;
  readonly lengthOut: number;
}

function handleFrame(anchor: Anchor, previous: Anchor | undefined, next: Anchor | undefined): HandleFrame {
  const inward = handleOffset(anchor.position, anchor.handleIn);
  const outward = handleOffset(anchor.position, anchor.handleOut);
  const inLength = inward ? Math.hypot(inward.x, inward.y) : 0;
  const outLength = outward ? Math.hypot(outward.x, outward.y) : 0;
  const outAxis = outward ? unit(outward) : null;
  if (outAxis && (!inward || outLength >= inLength)) {
    return { axis: outAxis, lengthIn: inLength, lengthOut: outLength };
  }
  const inAxis = inward ? unit(inward) : null;
  if (inAxis) {
    return {
      axis: { x: -inAxis.x, y: -inAxis.y },
      lengthIn: inLength,
      lengthOut: outLength,
    };
  }
  return inventedFrame(anchor, previous, next);
}

function inventedFrame(anchor: Anchor, previous: Anchor | undefined, next: Anchor | undefined): HandleFrame {
  const nextOffset = next ? delta(anchor.position, next.position) : null;
  const prevOffset = previous ? delta(previous.position, anchor.position) : null;
  const nextUnit = nextOffset ? unit(nextOffset) : null;
  const prevUnit = prevOffset ? unit(prevOffset) : null;
  let axis: Vec2 = { x: 1, y: 0 };
  if (nextUnit && prevUnit) {
    axis = unit({ x: prevUnit.x + nextUnit.x, y: prevUnit.y + nextUnit.y }) ?? {
      x: -nextUnit.y,
      y: nextUnit.x,
    };
  } else if (nextUnit) {
    axis = nextUnit;
  } else if (prevUnit) {
    axis = prevUnit;
  }
  return {
    axis,
    lengthIn: prevOffset ? Math.hypot(prevOffset.x, prevOffset.y) * HANDLE_LENGTH_FRACTION : FALLBACK_HANDLE_LENGTH,
    lengthOut: nextOffset ? Math.hypot(nextOffset.x, nextOffset.y) * HANDLE_LENGTH_FRACTION : FALLBACK_HANDLE_LENGTH,
  };
}

function placeHandles(anchor: Anchor, axis: Vec2, lengthIn: number, lengthOut: number): Anchor {
  return withHandles(anchor, pointOnAxis(anchor.position, axis, -lengthIn), pointOnAxis(anchor.position, axis, lengthOut));
}

function withHandles(anchor: Anchor, handleIn: Vec2 | null, handleOut: Vec2 | null): Anchor {
  if (samePoint(anchor.handleIn, handleIn) && samePoint(anchor.handleOut, handleOut)) {
    return anchor;
  }
  return { ...anchor, handleIn, handleOut };
}

function withSegmentKinds(subpath: Subpath, changedIds: ReadonlySet<string>): Subpath {
  const byId = new Map(subpath.anchors.map((anchor) => [anchor.id, anchor]));
  let changed = false;
  const segments = subpath.segments.map((segment) => {
    if (!changedIds.has(segment.fromId) && !changedIds.has(segment.toId)) {
      return segment;
    }
    const from = byId.get(segment.fromId);
    const to = byId.get(segment.toId);
    if (!from || !to) {
      return segment;
    }
    const kind: Segment['kind'] = from.handleOut || to.handleIn ? 'cubic' : 'line';
    if (segment.kind === kind) {
      return segment;
    }
    changed = true;
    return { ...segment, kind };
  });
  return changed ? { ...subpath, segments } : subpath;
}

function neighborAnchor(subpath: Subpath, index: number, step: -1 | 1): Anchor | undefined {
  const count = subpath.anchors.length;
  if (count < 2) {
    return undefined;
  }
  const nextIndex = index + step;
  if (subpath.closed) {
    return subpath.anchors[(nextIndex + count) % count];
  }
  if (nextIndex < 0 || nextIndex >= count) {
    return undefined;
  }
  return subpath.anchors[nextIndex];
}

function handleOffset(position: Vec2, handle: Vec2 | null): Vec2 | null {
  if (!handle) {
    return null;
  }
  const offset = delta(position, handle);
  return offset;
}

function pointOnAxis(origin: Vec2, axis: Vec2, distance: number): Vec2 {
  return { x: origin.x + axis.x * distance, y: origin.y + axis.y * distance };
}

function delta(from: Vec2, to: Vec2): Vec2 | null {
  const x = to.x - from.x;
  const y = to.y - from.y;
  return Math.hypot(x, y) <= HANDLE_EPSILON ? null : { x, y };
}

function unit(vector: Vec2): Vec2 | null {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= HANDLE_EPSILON) {
    return null;
  }
  return { x: vector.x / length, y: vector.y / length };
}

function nearlyEqualLength(left: number, right: number): boolean {
  const longest = Math.max(left, right);
  return Math.abs(left - right) <= Math.max(0.01, 0.01 * longest);
}

function validPartial(position: Partial<Vec2>): boolean {
  if (position.x === undefined && position.y === undefined) {
    return false;
  }
  if (position.x !== undefined && !Number.isFinite(position.x)) {
    return false;
  }
  return position.y === undefined || Number.isFinite(position.y);
}
