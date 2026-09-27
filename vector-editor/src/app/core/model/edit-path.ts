import { createId } from './create-id';
import { Anchor, Segment, SourcePath, Subpath, Vec2 } from './types';

export type HandleSlot = 'in' | 'out';

export function translateAnchors(
  source: SourcePath,
  ids: readonly string[],
  dx: number,
  dy: number,
): SourcePath {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
    return source;
  }
  return mapAnchors(source, ids, (anchor) => shiftAnchor(anchor, dx, dy));
}

export function setAnchorPosition(
  source: SourcePath,
  ids: readonly string[],
  position: Partial<Vec2>,
): SourcePath {
  if (!validPartial(position)) {
    return source;
  }
  return mapAnchors(source, ids, (anchor) => {
    const x = position.x ?? anchor.position.x;
    const y = position.y ?? anchor.position.y;
    return shiftAnchor(anchor, x - anchor.position.x, y - anchor.position.y);
  });
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
  if (
    (position.x !== undefined && !Number.isFinite(position.x)) ||
    (position.y !== undefined && !Number.isFinite(position.y))
  ) {
    return source;
  }
  return mapAnchors(source, ids, (anchor) => withHandle(anchor, slot, position, breakLink));
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

function mapAnchors(
  source: SourcePath,
  ids: readonly string[],
  update: (anchor: Anchor) => Anchor,
): SourcePath {
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

function withHandle(
  anchor: Anchor,
  slot: HandleSlot,
  position: Partial<Vec2>,
  breakLink: boolean,
): Anchor {
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
  return slot === 'in'
    ? { ...anchor, handleIn: next, handleOut: mirrored }
    : { ...anchor, handleIn: mirrored, handleOut: next };
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
    const existing = subpath.segments.find(
      (segment) => segment.fromId === from.id && segment.toId === to.id,
    );
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
    const segment = subpath.segments.find(
      (item) => item.fromId === ids[index] && item.toId === ids[nextIndex],
    );
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

function validPartial(position: Partial<Vec2>): boolean {
  if (position.x === undefined && position.y === undefined) {
    return false;
  }
  if (position.x !== undefined && !Number.isFinite(position.x)) {
    return false;
  }
  return position.y === undefined || Number.isFinite(position.y);
}
