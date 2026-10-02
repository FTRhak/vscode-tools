import { Anchor, Modifier, Segment, SourcePath, Subpath, Vec2 } from '../model/types';
import { collectPoints } from './flatten';

type RoundModifier = Extract<Modifier, { type: 'round' }>;

interface Placement {
  readonly position: Vec2;
  readonly handleIn: Vec2;
  readonly handleOut: Vec2;
}

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
    const circular = mode === 'circle' && subpath.closed;
    const handleMode = mode === 'direct' ? 'direct' : 'smooth';
    const starts = startPlacements(subpath, count);
    const startPoints = starts.map((start) => start.position);
    const endPoints = circular ? blendTowardCircle(startPoints, 1) : startPoints;
    const ends = placementsAt(endPoints, subpath.closed, handleMode, circular);
    const blended = starts.map((start, index) =>
      blendPlacement(start, ends[index] ?? start, roundness),
    );
    return makeSubpath(blended, subpath.closed, modifier.id, subpathIndex);
  });
  return { subpaths };
}

function startPlacements(subpath: Subpath, count: number): Placement[] {
  const ordered = anchorsInPathOrder(subpath);
  const base = ordered.map((anchor) => ({
    position: anchor.position,
    handleIn: anchor.handleIn ?? anchor.position,
    handleOut: anchor.handleOut ?? anchor.position,
  }));
  if (count < base.length) {
    return keepSignificant(base, count, subpath.closed);
  }
  if (count > base.length) {
    return insertPlacements(subpath, ordered, base, count);
  }
  return base;
}

function keepSignificant(
  base: readonly Placement[],
  count: number,
  closed: boolean,
): Placement[] {
  const weights = base.map((placement, index) => {
    const isEnd = index === 0 || index === base.length - 1;
    if (!closed && isEnd) {
      return Infinity;
    }
    const previous = base[(index - 1 + base.length) % base.length]?.position ?? placement.position;
    const next = base[(index + 1) % base.length]?.position ?? placement.position;
    return Math.abs(cross(subtract(previous, placement.position), subtract(next, placement.position)));
  });
  const kept = new Set(
    weights
      .map((weight, index) => ({ weight, index }))
      .sort((left, right) => right.weight - left.weight || left.index - right.index)
      .slice(0, count)
      .map((entry) => entry.index),
  );
  return base.filter((_, index) => kept.has(index));
}

function insertPlacements(
  subpath: Subpath,
  ordered: readonly Anchor[],
  base: readonly Placement[],
  count: number,
): Placement[] {
  const edgeCount = subpath.closed ? ordered.length : ordered.length - 1;
  if (edgeCount <= 0) {
    return [...base];
  }
  const edges = Array.from({ length: edgeCount }, (_, index) =>
    edgeCurve(subpath, ordered[index], ordered[(index + 1) % ordered.length]),
  );
  const lengths = edges.map(curveLength);
  const parts = edges.map(() => 1);
  for (let extra = count - base.length; extra > 0; extra -= 1) {
    let best = 0;
    for (let index = 1; index < edgeCount; index += 1) {
      if ((lengths[index] ?? 0) / (parts[index] ?? 1) > (lengths[best] ?? 0) / (parts[best] ?? 1)) {
        best = index;
      }
    }
    parts[best] = (parts[best] ?? 1) + 1;
  }
  const result: Placement[] = [];
  base.forEach((placement, index) => {
    result.push(placement);
    const edge = edges[index];
    const pieces = parts[index] ?? 1;
    if (!edge) {
      return;
    }
    for (let step = 1; step < pieces; step += 1) {
      result.push(splitPlacement(edge, step / pieces, 1 / pieces));
    }
  });
  return result;
}

interface Curve {
  readonly p0: Vec2;
  readonly p1: Vec2;
  readonly p2: Vec2;
  readonly p3: Vec2;
  readonly straight: boolean;
}

function edgeCurve(subpath: Subpath, from: Anchor | undefined, to: Anchor | undefined): Curve | null {
  if (!from || !to) {
    return null;
  }
  const segment = subpath.segments.find(
    (item) => item.fromId === from.id && item.toId === to.id,
  );
  const straight = segment?.kind !== 'cubic';
  return {
    p0: from.position,
    p1: straight ? from.position : (from.handleOut ?? from.position),
    p2: straight ? to.position : (to.handleIn ?? to.position),
    p3: to.position,
    straight,
  };
}

function curveLength(curve: Curve | null): number {
  if (!curve) {
    return 0;
  }
  const chord = distance(curve.p0, curve.p3);
  const net = distance(curve.p0, curve.p1) + distance(curve.p1, curve.p2) + distance(curve.p2, curve.p3);
  return (chord + net) / 2;
}

function splitPlacement(curve: Curve, t: number, span: number): Placement {
  const u = 1 - t;
  const position = {
    x: u * u * u * curve.p0.x + 3 * u * u * t * curve.p1.x + 3 * u * t * t * curve.p2.x + t * t * t * curve.p3.x,
    y: u * u * u * curve.p0.y + 3 * u * u * t * curve.p1.y + 3 * u * t * t * curve.p2.y + t * t * t * curve.p3.y,
  };
  if (curve.straight) {
    return { position, handleIn: position, handleOut: position };
  }
  const derivative = add(
    add(scale(subtract(curve.p1, curve.p0), 3 * u * u), scale(subtract(curve.p2, curve.p1), 6 * u * t)),
    scale(subtract(curve.p3, curve.p2), 3 * t * t),
  );
  const tangent = scale(derivative, span / 3);
  return { position, handleIn: subtract(position, tangent), handleOut: add(position, tangent) };
}

function anchorsInPathOrder(subpath: Subpath): Anchor[] {
  const byId = new Map(subpath.anchors.map((anchor) => [anchor.id, anchor]));
  const ordered: Anchor[] = [];
  const seen = new Set<string>();
  const push = (anchor: Anchor | undefined): void => {
    if (!anchor || seen.has(anchor.id)) {
      return;
    }
    seen.add(anchor.id);
    ordered.push(anchor);
  };
  for (const segment of subpath.segments) {
    push(byId.get(segment.fromId));
    push(byId.get(segment.toId));
  }
  for (const anchor of subpath.anchors) {
    push(anchor);
  }
  return ordered;
}

function placementsAt(
  points: readonly Vec2[],
  closed: boolean,
  mode: 'direct' | 'smooth',
  circular: boolean,
): Placement[] {
  const circleTangents = circular ? createCircleTangents(points, 1) : null;
  return points.map((position, index) => {
    const tangent = tangentAt(points, index, closed, mode, circleTangents);
    return {
      position,
      handleIn: subtract(position, tangent),
      handleOut: add(position, tangent),
    };
  });
}

function tangentAt(
  points: readonly Vec2[],
  index: number,
  closed: boolean,
  mode: 'direct' | 'smooth',
  circleTangents: readonly Vec2[] | null,
): Vec2 {
  const circleTangent = circleTangents?.[index];
  if (circleTangent) {
    return circleTangent;
  }
  const position = points[index] ?? { x: 0, y: 0 };
  const previous = points[index - 1] ?? (closed ? points[points.length - 1] : position);
  const next = points[index + 1] ?? (closed ? points[0] : position);
  if (mode === 'smooth') {
    return smoothTangent(position, previous, next, 1);
  }
  return scale(subtract(next, previous), 1 / 6);
}

function blendPlacement(start: Placement, end: Placement, amount: number): Placement {
  return {
    position: interpolate(start.position, end.position, amount),
    handleIn: interpolate(start.handleIn, end.handleIn, amount),
    handleOut: interpolate(start.handleOut, end.handleOut, amount),
  };
}

function makeSubpath(
  anchors: readonly Placement[],
  closed: boolean,
  modifierId: string,
  subpathIndex: number,
): Subpath {
  const built: Anchor[] = anchors.map((anchor, index) => ({
    id: `${modifierId}/${subpathIndex}/anchor/${index}`,
    position: anchor.position,
    handleIn: anchor.handleIn,
    handleOut: anchor.handleOut,
  }));
  const segmentCount = closed ? built.length : Math.max(0, built.length - 1);
  const segments: Segment[] = Array.from({ length: segmentCount }, (_, index) => {
    const from = built[index];
    const to = built[(index + 1) % built.length];
    return {
      id: `${modifierId}/${subpathIndex}/segment/${index}`,
      kind: 'cubic',
      fromId: from?.id ?? '',
      toId: to?.id ?? '',
    };
  });
  return { closed, anchors: built, segments };
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

function cross(left: Vec2, right: Vec2): number {
  return left.x * right.y - left.y * right.x;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
}