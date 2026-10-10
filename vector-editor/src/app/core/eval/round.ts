import { Anchor, Modifier, Segment, SourcePath, Subpath, Vec2 } from '@vector-editor/modules/types/types';
import { collectPoints } from './flatten';

type RoundModifier = Extract<Modifier, { type: 'round' }>;

/**
 * A path vertex together with the cubic handles stored on it.
 * Handles are absolute positions, the same way `Anchor` stores them:
 * `handleIn` is the incoming control point and `handleOut` is the outgoing one.
 */
interface Placement {
  readonly position: Vec2;
  readonly handleIn: Vec2;
  readonly handleOut: Vec2;
}

/**
 * Rebuilds every subpath so its corners become rounder as `roundness` rises.
 *
 * Each subpath is processed independently:
 * 1. Normalize `roundness` from the 0–100 modifier value to a blend factor in [0, 1].
 *    A non-finite value becomes 0.
 * 2. Skip a subpath that cannot form a curve (a closed loop needs 3 anchors, an
 *    open path needs 2).
 * 3. Resolve the target anchor count. A non-finite request keeps the current
 *    count; otherwise it is floored and clamped to [minimum, 1000].
 * 4. Return the subpath unchanged when nothing would change: roundness is 0 and
 *    the count already matches.
 * 5. Resample the original anchors to that count. This is the blend start, and
 *    it keeps the source handles. See `startPlacements`.
 * 6. Build the fully rounded target (the blend end):
 *    - `circle` on a closed subpath moves the vertices onto an evenly sampled
 *      circle, then sizes the handles with the circular-arc cubic formula.
 *    - `direct` and `smooth` (and `circle` on an open path) keep the resampled
 *      positions and replace the handles. `direct` uses the uniform Catmull–Rom
 *      tangent; `smooth` uses the angle-bisector tangent.
 * 7. Linearly interpolate position and both handles from start to end by the
 *    roundness factor. At 0 the resampled source is returned; at 1 the target is.
 * 8. Emit a new subpath whose every segment is a cubic.
 */
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

/**
 * Produces exactly `count` placements from the subpath's anchors.
 *
 * The anchors are first walked in drawing order and copied with their handles
 * (a missing handle collapses onto the anchor, which draws a sharp corner).
 * The count is then matched in one of three ways:
 * - fewer anchors than requested: insert samples on the longest remaining
 *   edge pieces (`insertPlacements`);
 * - more anchors than requested: drop the least significant corners
 *   (`keepSignificant`);
 * - same count: keep the copied anchors, handles included.
 */
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

/**
 * Reduces `base` to `count` placements by ranking corners and keeping the
 * strongest ones.
 *
 * Significance of a vertex is the absolute 2D cross product of the vectors
 * from that vertex to its previous and next neighbors:
 *   |(prev − p) × (next − p)|
 * which is twice the area of the triangle they form. A vertex sitting on the
 * line between its neighbors scores 0; a sharp spike scores high. Weights are
 * computed once against the original neighbors, so deleting one vertex does
 * not change the score of another. This is a single ranking pass, not an
 * iterative simplification such as Douglas–Peucker.
 *
 * On an open path the first and last vertices score infinity, so the endpoints
 * are always retained. Ties keep the earlier index. The winning indices are
 * then filtered back out in their original order, which preserves path order.
 */
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

/**
 * Inserts `count − base.length` new placements so the added points spread
 * along the longer edges.
 *
 * Each edge starts as one piece (the span between its existing endpoints).
 * Every extra point is given to the edge whose current piece is longest,
 * measured as `length / parts`. Ties keep the earlier edge, because a candidate
 * replaces the best edge only when its ratio is strictly greater. After the
 * extras are assigned, edge `i` is split into `parts[i]` equal parameter steps
 * and a placement is sampled at each interior step. Original vertices are
 * copied through unchanged, so their handles survive; only the new samples
 * get freshly computed handles.
 *
 * Edge length is the cheap cubic estimate from `curveLength`, not an exact
 * arc length. Equal parameter steps match arc length only on a straight edge.
 */
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

/**
 * One edge as a cubic Bézier.
 * `p0` and `p3` are the endpoints. `p1` and `p2` are the outgoing handle of
 * the start anchor and the incoming handle of the end anchor.
 * `straight` is set when the source segment is not a cubic, in which case
 * both handles lie on the endpoints and the curve is the chord.
 */
interface Curve {
  readonly p0: Vec2;
  readonly p1: Vec2;
  readonly p2: Vec2;
  readonly p3: Vec2;
  readonly straight: boolean;
}

/**
 * Builds the cubic for the segment that runs from `from` to `to`.
 *
 * The segment is found by matching `fromId` and `toId`. Anything other than
 * `kind: 'cubic'` (including a missing segment) is stored as a degenerate
 * cubic whose control points sit on the endpoints, so evaluation stays on the
 * straight chord and the endpoint derivatives are zero.
 */
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

/**
 * Approximates the length of a cubic as the average of its two bounds.
 *
 * The chord `|p3 − p0|` is a lower bound: the straight line is the shortest
 * path between the endpoints. The control polygon
 * `|p1 − p0| + |p2 − p1| + |p3 − p2|` is an upper bound: a Bézier curve is
 * never longer than the polyline of its control points. Their average is
 * cheap, stays between those bounds, and is accurate enough to decide which
 * edge should receive the next inserted point.
 */
function curveLength(curve: Curve | null): number {
  if (!curve) {
    return 0;
  }
  const chord = distance(curve.p0, curve.p3);
  const net = distance(curve.p0, curve.p1) + distance(curve.p1, curve.p2) + distance(curve.p2, curve.p3);
  return (chord + net) / 2;
}

/**
 * Samples a cubic at parameter `t` and builds a smooth placement there.
 *
 * Position uses the Bernstein form of the cubic, with `u = 1 − t`:
 *   B(t) = u³ p0 + 3 u² t p1 + 3 u t² p2 + t³ p3
 *
 * A straight edge gets coincident handles, so the new vertex stays a corner
 * on the chord. A curved edge takes the analytic derivative
 *   B'(t) = 3 u² (p1 − p0) + 6 u t (p2 − p1) + 3 t² (p3 − p2)
 * and turns it into a handle offset of `B'(t) · span / 3`.
 *
 * The division by 3 is the relationship between a cubic and its first control
 * point: the outgoing handle sits at `position + B'(t) / 3` when the parameter
 * step is 1. Multiplying by `span` (the parameter width of this new piece,
 * `1 / pieces`) shortens the handle in proportion to the piece it has to
 * cover. The incoming handle is the same vector mirrored, so the new anchor
 * is symmetric and the join is smooth.
 *
 * This matches position and tangent at the sample. It is not a de Casteljau
 * split of the parent: the neighboring original anchors keep the handles they
 * already had, and the rebuilt segment only approximates the source curve.
 */
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

/**
 * Orders anchors the way the path is drawn.
 *
 * The segment list is the source of order. Each segment contributes its start
 * anchor and then its end anchor, skipping any id already emitted, so a chain
 * `a→b`, `b→c` yields `[a, b, c]`. Anchors that no segment references are
 * appended afterwards in their array order, so none are dropped.
 */
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

/**
 * Turns a polyline into placements with symmetric cubic handles.
 *
 * For each point the tangent from `tangentAt` is applied in both directions:
 * `handleOut = position + tangent` and `handleIn = position − tangent`.
 * Equal, opposite handles make a smooth node whose control points are
 * collinear with the vertex.
 *
 * In circle mode the tangents come from the circular-arc formula and `mode`
 * is ignored. Otherwise `mode` selects the Catmull–Rom tangent (`direct`) or
 * the angle-bisector tangent (`smooth`).
 */
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

/**
 * Returns the handle offset at `points[index]`.
 *
 * A precomputed circle tangent wins when one exists. Otherwise the previous
 * and next points are the neighbors, wrapping around on a closed path. On an
 * open path a missing neighbor is the point itself, so that side contributes
 * a zero vector.
 *
 * `direct` converts the uniform Catmull–Rom tangent into a cubic handle.
 * The curve through `P[i − 1]`, `P[i]`, `P[i + 1]` has tangent
 * `(P[i + 1] − P[i − 1]) / 2`, and a cubic stores one third of its end
 * derivative as the handle, which simplifies to
 *   (next − previous) / 6
 * Interior joins from this formula are C1 under a uniform parameterization.
 *
 * `smooth` uses `smoothTangent` at full strength. Roundness is applied later,
 * when the resulting placement is blended back toward the source.
 */
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

/**
 * Linearly interpolates two placements.
 * Position, incoming handle, and outgoing handle are blended independently
 * with the same factor. Because handles are absolute positions, this moves
 * the control points along with the vertex. `amount` 0 returns `start` and
 * `amount` 1 returns `end`.
 */
function blendPlacement(start: Placement, end: Placement, amount: number): Placement {
  return {
    position: interpolate(start.position, end.position, amount),
    handleIn: interpolate(start.handleIn, end.handleIn, amount),
    handleOut: interpolate(start.handleOut, end.handleOut, amount),
  };
}

/**
 * Converts placements into a subpath of cubic segments.
 *
 * Anchor and segment ids are derived from the modifier id and the subpath
 * index, so repeated evaluation replaces the previous result instead of
 * colliding with source ids. A closed subpath gets one segment per anchor,
 * including the segment from the last anchor back to the first. An open
 * subpath gets one fewer segment and does not wrap.
 */
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

/**
 * Handle offset that rounds a corner by bisecting the turn.
 *
 * `incoming` is the edge arriving at the vertex and `outgoing` is the edge
 * leaving it. The result is scaled by `amount`, from a zero-length handle at
 * 0 (the corner stays sharp) to a full smooth join at 1.
 *
 * Degenerate edges are handled first. If only one neighbor is at a different
 * position, the tangent follows that edge with length `edgeLength · amount / 3`.
 * If both neighbors coincide with the vertex, the tangent is zero.
 *
 * Otherwise the two edge directions are normalized and added. The sum of the
 * unit vectors is the bisector of the arrival direction and the departure
 * direction, which is the tangent a smooth curve takes through the corner.
 * Unit length on both sides means a short edge and a long edge pull the
 * bisector equally; a plain average of the raw edges would favor the longer
 * one. If the edges run in exactly opposite directions the sum vanishes and
 * the tangent is zero, leaving a cusp.
 *
 * The handle length is `min(incomingLength, outgoingLength) · amount / 3`.
 * A cubic handle longer than about one third of the neighboring segment
 * bulges or loops, and using the shorter neighbor keeps both sides inside
 * that limit.
 */
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

/**
 * Handle offsets that make consecutive vertices join as a circular arc.
 *
 * The center is the centroid of `points`, the same center `blendTowardCircle`
 * uses, so once vertices sit on that circle the radii match. For vertex `i`
 * the central angle `θ` to the next vertex is the absolute angle between the
 * two radii, recovered with `atan2` of their cross and dot products.
 *
 * The unit tangent is the radius rotated 90° counterclockwise, `(-y, x) / R`.
 * If the next vertex lies clockwise from this one (the cross product is
 * negative), the tangent is flipped so it follows the path.
 *
 * The handle length is the standard cubic approximation of a circular arc:
 *   (4 / 3) · R · tan(θ / 4) · amount
 * It is the unique handle length that matches the circle's position and first
 * derivative at both ends of a symmetric arc. For a quarter circle, `θ = π / 2`,
 * it reduces to the constant `(4 / 3) tan(π / 8) ≈ 0.5523 R`. The error stays
 * small while each edge spans well under 90°; more anchors make `θ` smaller
 * and the approximation tighter. `amount` scales the handles from sharp
 * corners at 0 to the full arc at 1.
 *
 * One vector is returned per vertex and later mirrored into both handles.
 * Its length comes from the angle to the next vertex only. After
 * `blendTowardCircle` every central angle is `2π / n`, so the incoming and
 * outgoing arcs are the same and the mirrored handle is the correct length.
 */
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

/**
 * Moves each point toward an evenly spaced sample on a fitted circle.
 *
 * The circle is not a least-squares fit. Its center is the centroid, and its
 * radius is the average distance from that centroid. Fewer than 3 points, or
 * a zero radius, returns the input unchanged.
 *
 * Winding is the sign of the shoelace sum
 *   Σ (xᵢ yᵢ₊₁ − xᵢ₊₁ yᵢ)
 * A negative sum walks clockwise in y-up coordinates, so samples step by
 * `-2π / n`; otherwise they step by `+2π / n`. The first point keeps its
 * current polar angle, and point `i` is placed at
 *   startAngle + direction · 2π · i / n
 * on the circle. Only path order and winding are preserved: the original
 * angles of the later points are discarded, which is what turns an irregular
 * loop into a regular one.
 *
 * Each source point is then linearly interpolated toward its sample.
 * `applyRound` calls this with `amount` 1, so the target vertices lie on the
 * circle; the modifier's own roundness blends those targets back toward the
 * resampled source afterwards.
 */
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

/** Linear interpolation: `start + (end − start) · amount`. */
function interpolate(start: Vec2, end: Vec2, amount: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

/** Vector addition. */
function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y };
}

/** Vector subtraction, `left − right`. */
function subtract(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x - right.x, y: left.y - right.y };
}

/** Scalar multiplication of both components. */
function scale(point: Vec2, amount: number): Vec2 {
  return { x: point.x * amount, y: point.y * amount };
}

/** Euclidean distance between two points. */
function distance(start: Vec2, end: Vec2): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

/**
 * Z component of the 3D cross product, `left.x · right.y − left.y · right.x`.
 * This is the signed area of the parallelogram spanned by the two vectors.
 * It is positive when `right` lies counterclockwise from `left`, negative when
 * clockwise, and zero when the vectors are parallel.
 */
function cross(left: Vec2, right: Vec2): number {
  return left.x * right.y - left.y * right.x;
}

/**
 * Clamps `value` to `[minimum, maximum]`.
 * A non-finite value (NaN or ±infinity) returns `minimum`, which lets a bad
 * roundness setting fall back to "no rounding" rather than producing NaN
 * positions downstream.
 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
}
