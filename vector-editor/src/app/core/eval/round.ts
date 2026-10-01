import { Anchor, Modifier, Segment, SourcePath, Subpath, Vec2 } from '../model/types';
import { collectPoints } from './flatten';

type RoundModifier = Extract<Modifier, { type: 'round' }>;

export function applyRound(source: SourcePath, modifier: RoundModifier): SourcePath {
  const mode = modifier.mode ?? 'direct';
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
    const pointsForMode =
      mode === 'circle' && subpath.closed
        ? blendTowardCircle(sampled, roundness)
        : sampled;
    const handleMode = mode === 'direct' ? 'direct' : 'smooth';
    return makeSubpath(
      pointsForMode,
      subpath.closed,
      roundness,
      handleMode,
      mode === 'circle' && subpath.closed,
      modifier.id,
      subpathIndex,
    );
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
  mode: 'direct' | 'smooth',
  circularHandles: boolean,
  modifierId: string,
  subpathIndex: number,
): Subpath {
  const circleTangents = circularHandles ? createCircleTangents(points, roundness) : null;
  const anchors: Anchor[] = points.map((position, index) => {
    const previous = points[index - 1] ?? (closed ? points[points.length - 1] : position);
    const next = points[index + 1] ?? (closed ? points[0] : position);
    const tangent = circleTangents?.[index]
      ? circleTangents[index]
      : mode === 'smooth'
        ? smoothTangent(position, previous, next, roundness)
        : previous && next
          ? scale(subtract(next, previous), roundness / 6)
          : { x: 0, y: 0 };
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

function smoothTangent(position: Vec2, previous: Vec2, next: Vec2, amount: number): Vec2 {
  const incoming = subtract(position, previous);
  const outgoing = subtract(next, position);
  const incomingLength = distance(position, previous);
  const outgoingLength = distance(position, next);
  if (incomingLength === 0 && outgoingLength > 0) {
    return scale(outgoing, amount / 3);
  }
  if (outgoingLength === 0 && incomingLength > 0) {
    return scale(incoming, amount / 3);
  }
  if (incomingLength === 0 || outgoingLength === 0) {
    return { x: 0, y: 0 };
  }
  const incomingDirection = scale(incoming, 1 / incomingLength);
  const outgoingDirection = scale(outgoing, 1 / outgoingLength);
  const direction = add(incomingDirection, outgoingDirection);
  const directionLength = Math.hypot(direction.x, direction.y);
  if (directionLength === 0) {
    return { x: 0, y: 0 };
  }
  const handleLength = (Math.min(incomingLength, outgoingLength) * amount) / 3;
  return scale(direction, handleLength / directionLength);
}

function createCircleTangents(points: readonly Vec2[], amount: number): Vec2[] {
  const center = {
    x: points.reduce((sum, point) => sum + point.x / points.length, 0),
    y: points.reduce((sum, point) => sum + point.y / points.length, 0),
  };
  return points.map((position, index) => {
    const next = points[(index + 1) % points.length];
    if (!next) {
      return { x: 0, y: 0 };
    }
    const radial = subtract(position, center);
    const nextRadial = subtract(next, center);
    const radius = Math.hypot(radial.x, radial.y);
    const nextRadius = Math.hypot(nextRadial.x, nextRadial.y);
    if (radius === 0 || nextRadius === 0) {
      return { x: 0, y: 0 };
    }
    const cross = radial.x * nextRadial.y - radial.y * nextRadial.x;
    const dot = radial.x * nextRadial.x + radial.y * nextRadial.y;
    const angle = Math.abs(Math.atan2(cross, dot));
    const tangentDirection = { x: -radial.y / radius, y: radial.x / radius };
    const orientation = cross < 0 ? -1 : 1;
    const controlLength = (4 / 3) * radius * Math.tan(angle / 4) * amount;
    return scale(tangentDirection, controlLength * orientation);
  });
}

function blendTowardCircle(points: readonly Vec2[], amount: number): Vec2[] {
  if (points.length < 3) {
    return [...points];
  }
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
  const radius =
    points.reduce((sum, point) => sum + distance(center, point), 0) / points.length;
  if (radius === 0) {
    return [...points];
  }
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return next ? sum + point.x * next.y - next.x * point.y : sum;
  }, 0);
  const direction = area < 0 ? -1 : 1;
  const startAngle = Math.atan2(
    (points[0]?.y ?? center.y) - center.y,
    (points[0]?.x ?? center.x) - center.x,
  );
  return points.map((point, index) => {
    const angle = startAngle + (direction * 2 * Math.PI * index) / points.length;
    const circlePoint = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    return interpolate(point, circlePoint, amount);
  });
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