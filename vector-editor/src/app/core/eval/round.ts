import { Anchor, Modifier, Segment, SourcePath, Subpath, Vec2 } from '../model/types';
import { collectPoints } from './flatten';

type RoundModifier = Extract<Modifier, { type: 'round' }>;

export function applyRound(source: SourcePath, modifier: RoundModifier): SourcePath {
  const roundness = clamp(modifier.roundness, 0, 100) / 100;
  const subpaths = source.subpaths.map((subpath, subpathIndex) => {
    const points = collectPoints(subpath);
    const minimum = subpath.closed ? 3 : 2;
    if (points.length < minimum) {
      return subpath;
    }
    const requestedCount = Number.isFinite(modifier.anchorCount)
      ? Math.floor(modifier.anchorCount)
      : subpath.anchors.length;
    const count = Math.max(minimum, Math.min(1000, requestedCount));
    if (roundness === 0 && count === subpath.anchors.length) {
      return subpath;
    }
    const sampled = resample(points, count, subpath.closed);
    return makeSubpath(sampled, subpath.closed, roundness, modifier.id, subpathIndex);
  });
  return { subpaths };
}

function resample(points: readonly Vec2[], count: number, closed: boolean): Vec2[] {
  const path = [...points];
  if (closed && path.length > 1 && samePoint(path[0], path[path.length - 1])) {
    path.pop();
  }
  const edgeCount = closed ? path.length : path.length - 1;
  const lengths: number[] = [];
  let total = 0;
  for (let index = 0; index < edgeCount; index += 1) {
    const start = path[index];
    const end = path[(index + 1) % path.length];
    const length = start && end ? distance(start, end) : 0;
    lengths.push(length);
    total += length;
  }
  if (total === 0) {
    return Array.from({ length: count }, () => path[0] ?? { x: 0, y: 0 });
  }

  return Array.from({ length: count }, (_, pointIndex) => {
    const target = (total * pointIndex) / (closed ? count : count - 1);
    let traversed = 0;
    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
      const edgeLength = lengths[edgeIndex] ?? 0;
      if (target <= traversed + edgeLength || edgeIndex === edgeCount - 1) {
        const start = path[edgeIndex] ?? path[0] ?? { x: 0, y: 0 };
        const end = path[(edgeIndex + 1) % path.length] ?? start;
        const t = edgeLength === 0 ? 0 : (target - traversed) / edgeLength;
        return interpolate(start, end, clamp(t, 0, 1));
      }
      traversed += edgeLength;
    }
    return path[0] ?? { x: 0, y: 0 };
  });
}

function makeSubpath(
  points: readonly Vec2[],
  closed: boolean,
  roundness: number,
  modifierId: string,
  subpathIndex: number,
): Subpath {
  const anchors: Anchor[] = points.map((position, index) => {
    const previous = points[index - 1] ?? (closed ? points[points.length - 1] : position);
    const next = points[index + 1] ?? (closed ? points[0] : position);
    const tangent = previous && next ? scale(subtract(next, previous), roundness / 6) : { x: 0, y: 0 };
    return {
      id: `${modifierId}/${subpathIndex}/anchor/${index}`,
      position,
      handleIn: subtract(position, tangent),
      handleOut: add(position, tangent),
    };
  });
  const segmentCount = closed ? anchors.length : Math.max(0, anchors.length - 1);
  const segments: Segment[] = Array.from({ length: segmentCount }, (_, index) => {
    const from = anchors[index];
    const to = anchors[(index + 1) % anchors.length];
    return {
      id: `${modifierId}/${subpathIndex}/segment/${index}`,
      kind: 'cubic',
      fromId: from?.id ?? '',
      toId: to?.id ?? '',
    };
  });
  return { closed, anchors, segments };
}

function interpolate(start: Vec2, end: Vec2, amount: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y };
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x - right.x, y: left.y - right.y };
}

function scale(point: Vec2, amount: number): Vec2 {
  return { x: point.x * amount, y: point.y * amount };
}

function distance(start: Vec2, end: Vec2): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function samePoint(left: Vec2 | undefined, right: Vec2 | undefined): boolean {
  return !!left && !!right && left.x === right.x && left.y === right.y;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
}