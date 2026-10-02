import { addModifier, applyModifier } from '../model/modifier-edits';
import { Modifier, SourcePath, Vec2, VectorObject } from '../model/types';
import { sourceBounds } from './bounds';
import { captureClipperHold, evaluateDocument, evaluateSource } from './evaluate';
import { collectPoints } from './flatten';

describe('evaluateSource', () => {
  it('copies a cubic path by the array offset and keeps the segment kind', () => {
    const source = path('a', { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 2 }, { x: 2, y: -1 });
    const evaluated = evaluateSource(source, [
      array('copies', { count: 3, offsetX: 5, offsetY: 6 }),
    ]);

    expect(evaluated.diagnostics).toEqual([]);
    expect(evaluated.source.subpaths).toHaveLength(3);
    expect(evaluated.source.subpaths[0]).toBe(source.subpaths[0]);
    const copy = evaluated.source.subpaths[2];
    expect(copy?.closed).toBe(false);
    expect(copy?.segments[0]?.kind).toBe('cubic');
    expect(copy?.anchors[0]).toMatchObject({
      id: 'a/copies/2',
      position: { x: 10, y: 12 },
      handleOut: { x: 11, y: 14 },
    });
    expect(copy?.anchors[1]).toMatchObject({
      id: 'b/copies/2',
      position: { x: 13, y: 12 },
      handleIn: { x: 12, y: 11 },
    });
    expect(copy?.segments[0]?.fromId).toBe('a/copies/2');
  });

  it('reflects handles across the horizontal center', () => {
    const source = path('a', { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 2, y: 4 }, null);
    const evaluated = evaluateSource(source, [mirror('flip', 'x')]);
    const copy = evaluated.source.subpaths[1];

    expect(evaluated.source.subpaths).toHaveLength(2);
    expect(copy?.closed).toBe(false);
    expect(copy?.anchors[0]).toMatchObject({
      position: { x: 0, y: 4 },
      handleOut: { x: 2, y: 0 },
    });
    expect(copy?.anchors[1]?.position).toEqual({ x: 6, y: 4 });
  });

  it('leaves the path unchanged when the step is disabled', () => {
    const source = path('a', { x: 0, y: 0 }, { x: 4, y: 0 }, null, null);
    const evaluated = evaluateSource(source, [array('copies', { enabled: false })]);

    expect(evaluated.source).toBe(source);
    expect(evaluated.diagnostics).toEqual([]);
  });

  it('resamples anchors and rounds a path with cubic handles', () => {
    const rounded = evaluateSource(squarePath('square', 0, 0, 10), [
      { id: 'round', type: 'round', mode: 'direct', anchorCount: 8, roundness: 100, enabled: true },
    ]).source.subpaths[0];

    expect(rounded?.anchors).toHaveLength(8);
    expect(rounded?.segments).toHaveLength(8);
    expect(rounded?.segments.every((segment) => segment.kind === 'cubic')).toBe(true);
    expect(
      rounded?.anchors.some(
        (anchor) =>
          anchor.handleOut?.x !== anchor.position.x || anchor.handleOut?.y !== anchor.position.y,
      ),
    ).toBe(true);
  });

  it('recalculates smooth handles without moving the sampled anchors', () => {
    const direct = evaluateSource(squarePath('square', 0, 0, 10), [
      { id: 'round', type: 'round', mode: 'direct', anchorCount: 8, roundness: 100, enabled: true },
    ]).source.subpaths[0];
    const smooth = evaluateSource(squarePath('square', 0, 0, 10), [
      { id: 'round', type: 'round', mode: 'smooth', anchorCount: 8, roundness: 100, enabled: true },
    ]).source.subpaths[0];

    expect(smooth?.anchors.map((anchor) => anchor.position)).toEqual(
      direct?.anchors.map((anchor) => anchor.position),
    );
    expect(smooth?.anchors[0]?.handleOut).not.toEqual(direct?.anchors[0]?.handleOut);
  });

  it('moves closed round paths toward a fitted circle in circle mode', () => {
    const circle = evaluateSource(squarePath('square', 0, 0, 10), [
      { id: 'round', type: 'round', mode: 'circle', anchorCount: 8, roundness: 100, enabled: true },
    ]).source.subpaths[0];
    const anchors = circle?.anchors ?? [];
    const center = {
      x: anchors.reduce((sum, anchor) => sum + anchor.position.x / anchors.length, 0),
      y: anchors.reduce((sum, anchor) => sum + anchor.position.y / anchors.length, 0),
    };
    const radii = anchors.map((anchor) =>
      Math.hypot(anchor.position.x - center.x, anchor.position.y - center.y),
    );

    expect(anchors).toHaveLength(8);
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-8);
    expect(anchors[0]?.handleOut).not.toEqual(anchors[0]?.position);
  });

  it('blends handleIn and handleOut from the original handles to the rounded handles', () => {
    const source = path('a', { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 });
    const at = (roundness: number) =>
      evaluateSource(source, [
        { id: 'round', type: 'round', mode: 'direct', anchorCount: 2, roundness, enabled: true },
      ]).source.subpaths[0];

    const start = at(0);
    const end = at(100);

    expect(start?.anchors[0]?.handleOut).toEqual({ x: 0, y: 10 });
    expect(end?.anchors[0]?.handleOut).not.toEqual({ x: 0, y: 10 });
    expectBlended(start, at(25), end, 0.25);
    expectBlended(start, at(50), end, 0.5);
    expectBlended(start, at(75), end, 0.75);
  });

  it('blends circle handles from the source points to the finished circle handles', () => {
    const source = trianglePath();
    const at = (roundness: number) =>
      evaluateSource(source, [
        { id: 'round', type: 'round', mode: 'circle', anchorCount: 3, roundness, enabled: true },
      ]).source.subpaths[0];

    const start = at(0);
    const end = at(100);

    expect(end?.anchors[0]?.handleOut).not.toEqual(end?.anchors[0]?.position);
    expectBlended(start, at(25), end, 0.25);
    expectBlended(start, at(50), end, 0.5);
    expectBlended(start, at(75), end, 0.75);
  });

  it('defaults the round anchor count from the previous modifier output', () => {
    const object = shape('square', squarePath('square', 0, 0, 10), [array('copies')]);
    const updated = addModifier(object, 'round');
    const round = updated.modifiers.at(-1);

    expect(round).toMatchObject({ type: 'round', mode: 'direct', anchorCount: 4, roundness: 50 });
  });

  it('tiles a mirrored shape and mirrors an array around the combined center', () => {
    const source = path('a', { x: 0, y: 0 }, { x: 4, y: 2 }, null, null);
    const mirroredThenArray = evaluateSource(source, [
      mirror('flip', 'x'),
      array('copies', { offsetX: 0, offsetY: 10, count: 2 }),
    ]).source;
    const arrayThenMirror = evaluateSource(source, [
      array('copies', { offsetX: 0, offsetY: 10, count: 2 }),
      mirror('flip', 'x'),
    ]).source;

    expect(positions(mirroredThenArray)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
      ],
      [
        { x: 0, y: 2 },
        { x: 4, y: 0 },
      ],
      [
        { x: 0, y: 10 },
        { x: 4, y: 12 },
      ],
      [
        { x: 0, y: 12 },
        { x: 4, y: 10 },
      ],
    ]);
    expect(positions(arrayThenMirror)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
      ],
      [
        { x: 0, y: 10 },
        { x: 4, y: 12 },
      ],
      [
        { x: 0, y: 12 },
        { x: 4, y: 10 },
      ],
      [
        { x: 0, y: 2 },
        { x: 4, y: 0 },
      ],
    ]);
    expect(sourceBounds(mirroredThenArray)).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 12 });
    expect(sourceBounds(arrayThenMirror)).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 12 });
    expect(positions(arrayThenMirror)[1]).not.toEqual(positions(mirroredThenArray)[1]);
  });

  it('skips a disabled bevel and leaves the source untouched', () => {
    const source = path('a', { x: 0, y: 0 }, { x: 1, y: 0 }, null, null);
    const evaluated = evaluateSource(source, [
      {
        id: 'off',
        type: 'bevel',
        distance: 2,
        join: 'round',
        miterLimit: 4,
        enabled: false,
      },
    ]);

    expect(evaluated.source).toBe(source);
    expect(evaluated.diagnostics).toEqual([]);
  });
});

describe('bevel and boolean', () => {
  it('keeps a cubic within the flatten tolerance', () => {
    const points = collectPoints({
      closed: false,
      anchors: [
        { id: 'a', position: { x: 0, y: 0 }, handleIn: null, handleOut: { x: 0, y: 10 } },
        { id: 'b', position: { x: 10, y: 0 }, handleIn: { x: 10, y: 10 }, handleOut: null },
      ],
      segments: [{ id: 's', kind: 'cubic', fromId: 'a', toId: 'b' }],
    });

    expect(points.length).toBeGreaterThan(2);
    expect(distanceToPolyline({ x: 5, y: 7.5 }, points)).toBeLessThanOrEqual(0.25);
  });

  it('chamfers a square and turns an open path into a closed band', () => {
    const square = evaluateDocument([
      shape('plate', squarePath('plate', 0, 0, 10), [
        bevel('edge', { distance: 2, join: 'bevel' }),
      ]),
    ])[0];
    const points = square?.subpaths.flatMap((subpath) =>
      subpath.anchors.map((anchor) => anchor.position),
    );

    expect(square?.subpaths[0]?.closed).toBe(true);
    expect(square?.subpaths[0]?.segments.every((segment) => segment.kind === 'line')).toBe(true);
    expect(points).toContainEqual({ x: 12, y: 10 });
    expect(points).toContainEqual({ x: 10, y: 12 });
    expect(points).not.toContainEqual({ x: 12, y: 12 });
    expect(points).not.toContainEqual({ x: 10, y: 10 });

    const band = evaluateDocument([
      shape('line', path('a', { x: 0, y: 0 }, { x: 10, y: 0 }, null, null), [
        bevel('stroke', { distance: 2, join: 'round' }),
      ]),
    ])[0];
    const ys = band?.subpaths.flatMap((subpath) =>
      subpath.anchors.map((anchor) => anchor.position.y),
    );

    expect(band?.subpaths[0]?.closed).toBe(true);
    expect(Math.min(...(ys ?? []))).toBeLessThan(-1);
    expect(Math.max(...(ys ?? []))).toBeGreaterThan(1);
  });

  it('cuts a hole, distinguishes union from intersect, and follows a moved operand', () => {
    const owner = shape('owner', squarePath('owner', 0, 0, 10), [
      booleanOp('cut', 'difference', 'operand'),
    ]);
    const operand = shape('operand', squarePath('operand', 2, 2, 6), []);
    const difference = evaluateDocument([owner, operand])[0];
    const united = evaluateDocument([
      shape('owner', squarePath('owner', 0, 0, 10), [booleanOp('cut', 'union', 'operand')]),
      operand,
    ])[0];
    const shared = evaluateDocument([
      shape('owner', squarePath('owner', 0, 0, 10), [booleanOp('cut', 'intersect', 'operand')]),
      operand,
    ])[0];

    expect(difference?.fillRule).toBe('evenodd');
    expect(difference?.subpaths).toHaveLength(2);
    expect(difference?.diagnostics).toEqual([]);
    const hole = [...(difference?.subpaths ?? [])].sort(
      (left, right) => Math.abs(ringArea(left)) - Math.abs(ringArea(right)),
    )[0];
    expect(sourceBounds({ subpaths: hole ? [hole] : [] })).toEqual({
      minX: 2,
      minY: 2,
      maxX: 8,
      maxY: 8,
    });
    expect(sourceBounds({ subpaths: united?.subpaths ?? [] })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
    });
    expect(sourceBounds({ subpaths: shared?.subpaths ?? [] })).toEqual({
      minX: 2,
      minY: 2,
      maxX: 8,
      maxY: 8,
    });

    const moved = evaluateDocument([
      owner,
      {
        ...shape('operand', squarePath('operand', 0, 0, 4), []),
        transform: { x: 3, y: 3, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
      },
    ])[0];
    const movedHole = [...(moved?.subpaths ?? [])].sort(
      (left, right) => Math.abs(ringArea(left)) - Math.abs(ringArea(right)),
    )[0];
    expect(sourceBounds({ subpaths: movedHole ? [movedHole] : [] })).toEqual({
      minX: 3,
      minY: 3,
      maxX: 7,
      maxY: 7,
    });
  });

  it('reports open paths, a missing operand, a self operand, a cycle, and a singular transform', () => {
    const open = shape('owner', path('a', { x: 0, y: 0 }, { x: 4, y: 0 }, null, null), [
      booleanOp('cut', 'difference', 'operand'),
    ]);
    const operand = shape('operand', squarePath('operand', 0, 0, 4), []);
    const openResult = evaluateDocument([open, operand])[0];
    expect(openResult?.subpaths).toBe(open.source.subpaths);
    expect(openResult?.diagnostics).toEqual(['Boolean needs closed paths.']);

    const missingSource = squarePath('owner', 0, 0, 4);
    const missing = evaluateDocument([
      shape('owner', missingSource, [booleanOp('cut', 'union', 'gone')]),
    ])[0];
    expect(missing?.subpaths).toBe(missingSource.subpaths);
    expect(missing?.diagnostics).toEqual(['Boolean operand is missing.']);

    const self = evaluateDocument([
      shape('owner', squarePath('owner', 0, 0, 4), [booleanOp('cut', 'union', 'owner')]),
    ])[0];
    expect(self?.diagnostics).toEqual(['Boolean operand is the same object.']);

    const left = shape('left', squarePath('left', 0, 0, 4), [
      booleanOp('to-right', 'union', 'right'),
    ]);
    const right = shape('right', squarePath('right', 1, 1, 4), [
      booleanOp('to-left', 'union', 'left'),
    ]);
    const cycle = evaluateDocument([left, right]);
    expect(cycle[0]?.subpaths).toBe(left.source.subpaths);
    expect(cycle[1]?.subpaths).toBe(right.source.subpaths);
    expect(cycle[0]?.diagnostics).toEqual(['Boolean operands form a cycle.']);
    expect(cycle[1]?.diagnostics).toEqual(['Boolean operands form a cycle.']);

    const flat = evaluateDocument([
      {
        ...shape('owner', squarePath('owner', 0, 0, 4), [
          booleanOp('cut', 'difference', 'operand'),
        ]),
        transform: { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 1, originX: 0, originY: 0 },
      },
      operand,
    ])[0];
    expect(flat?.diagnostics).toEqual(['Boolean transform cannot be inverted.']);
    expect(flat?.fillRule).toBe('nonzero');
  });

  it('copies a boolean polyline and bakes it with evenodd', () => {
    const owner = shape('owner', squarePath('owner', 0, 0, 10), [
      booleanOp('cut', 'difference', 'operand'),
      array('copies', { count: 2, offsetX: 30, offsetY: 0 }),
    ]);
    const operand = shape('operand', squarePath('operand', 2, 2, 6), []);
    const copied = evaluateDocument([owner, operand])[0];
    const base = evaluateDocument([
      shape('owner', squarePath('owner', 0, 0, 10), [booleanOp('cut', 'difference', 'operand')]),
      operand,
    ])[0];

    expect(copied?.subpaths).toHaveLength((base?.subpaths.length ?? 0) * 2);
    expect(copied?.subpaths[2]?.anchors[0]?.position.x).toBeCloseTo(
      (base?.subpaths[0]?.anchors[0]?.position.x ?? 0) + 30,
      5,
    );
    expect(
      copied?.subpaths.every((subpath) =>
        subpath.segments.every((segment) => segment.kind === 'line'),
      ),
    ).toBe(true);

    const baked = applyModifier(owner, 'cut', [owner, operand]);
    expect(baked.modifiers.map((modifier) => modifier.type)).toEqual(['array']);
    expect(baked.style.fillRule).toBe('evenodd');
    expect(baked.source.subpaths[0]?.segments.every((segment) => segment.kind === 'line')).toBe(
      true,
    );
    expect(baked.source.subpaths[0]?.anchors[0]?.id).not.toBe('owner-a');
  });

  it('freezes clipper output during a hold and lets array keep moving', () => {
    const owner = shape('owner', squarePath('owner', 0, 0, 10), [
      booleanOp('cut', 'difference', 'operand'),
      array('copies', { count: 2, offsetX: 30, offsetY: 0 }),
    ]);
    const operand = shape('operand', squarePath('operand', 2, 2, 6), []);
    const before = evaluateDocument([owner, operand]);
    const hold = captureClipperHold([owner, operand]);
    const movedOwner = {
      ...owner,
      source: translatePath(owner.source, 5, 0),
    };
    const held = evaluateDocument([movedOwner, operand], hold);
    const released = evaluateDocument([movedOwner, operand]);

    expect(held[0]?.subpaths).toEqual(before[0]?.subpaths);
    expect(released[0]?.subpaths).not.toEqual(held[0]?.subpaths);

    const shifted = {
      ...owner,
      modifiers: owner.modifiers.map((modifier) =>
        modifier.type === 'array' ? { ...modifier, offsetX: 80 } : modifier,
      ),
    };
    const liveCopies = evaluateDocument([shifted, operand], hold)[0];
    expect(liveCopies?.subpaths[0]).toEqual(before[0]?.subpaths[0]);
    expect(liveCopies?.subpaths[2]?.anchors[0]?.position.x).toBeCloseTo(
      (before[0]?.subpaths[0]?.anchors[0]?.position.x ?? 0) + 80,
      5,
    );
  });
});

function path(
  id: string,
  start: Vec2,
  end: Vec2,
  handleOut: Vec2 | null,
  handleIn: Vec2 | null,
): SourcePath {
  return {
    subpaths: [
      {
        closed: false,
        anchors: [
          { id, position: start, handleIn: null, handleOut },
          { id: 'b', position: end, handleIn, handleOut: null },
        ],
        segments: [
          { id: 's', kind: handleOut || handleIn ? 'cubic' : 'line', fromId: id, toId: 'b' },
        ],
      },
    ],
  };
}

function array(
  id: string,
  patch: Partial<Extract<Modifier, { type: 'array' }>> = {},
): Extract<Modifier, { type: 'array' }> {
  return {
    id,
    type: 'array',
    count: 2,
    offsetX: 10,
    offsetY: 0,
    enabled: true,
    ...patch,
  };
}

function mirror(id: string, axis: 'x' | 'y' | 'xy'): Extract<Modifier, { type: 'mirror' }> {
  return { id, type: 'mirror', axis, enabled: true };
}

function positions(source: SourcePath): Vec2[][] {
  return source.subpaths.map((subpath) => subpath.anchors.map((anchor) => anchor.position));
}

function bevel(
  id: string,
  patch: Partial<Extract<Modifier, { type: 'bevel' }>> = {},
): Extract<Modifier, { type: 'bevel' }> {
  return { id, type: 'bevel', distance: 2, join: 'bevel', miterLimit: 4, enabled: true, ...patch };
}

function booleanOp(
  id: string,
  operation: 'union' | 'difference' | 'intersect',
  operandId: string,
): Extract<Modifier, { type: 'boolean' }> {
  return { id, type: 'boolean', operation, operandId, enabled: true };
}

function expectBlended(
  start: SourcePath['subpaths'][number] | undefined,
  mid: SourcePath['subpaths'][number] | undefined,
  end: SourcePath['subpaths'][number] | undefined,
  amount: number,
): void {
  expect(mid?.anchors).toHaveLength(start?.anchors.length ?? 0);
  mid?.anchors.forEach((anchor, index) => {
    const from = start?.anchors[index];
    const to = end?.anchors[index];
    expect(from).toBeDefined();
    expect(to).toBeDefined();
    if (!from || !to) {
      return;
    }
    expect(anchor.position.x).toBeCloseTo(lerp(from.position.x, to.position.x, amount), 5);
    expect(anchor.position.y).toBeCloseTo(lerp(from.position.y, to.position.y, amount), 5);
    const fromIn = from.handleIn ?? from.position;
    const toIn = to.handleIn ?? to.position;
    const fromOut = from.handleOut ?? from.position;
    const toOut = to.handleOut ?? to.position;
    expect(anchor.handleIn?.x).toBeCloseTo(lerp(fromIn.x, toIn.x, amount), 5);
    expect(anchor.handleIn?.y).toBeCloseTo(lerp(fromIn.y, toIn.y, amount), 5);
    expect(anchor.handleOut?.x).toBeCloseTo(lerp(fromOut.x, toOut.x, amount), 5);
    expect(anchor.handleOut?.y).toBeCloseTo(lerp(fromOut.y, toOut.y, amount), 5);
  });
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function trianglePath(): SourcePath {
  const corners = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 12, y: 0 },
    { id: 'c', x: 3, y: 8 },
  ];
  return {
    subpaths: [
      {
        closed: true,
        anchors: corners.map((corner) => ({
          id: corner.id,
          position: { x: corner.x, y: corner.y },
          handleIn: null,
          handleOut: null,
        })),
        segments: corners.map((corner, index) => ({
          id: `s${index}`,
          kind: 'line' as const,
          fromId: corner.id,
          toId: corners[(index + 1) % corners.length]?.id ?? corner.id,
        })),
      },
    ],
  };
}

function squarePath(id: string, x: number, y: number, size: number): SourcePath {
  const corners = [
    { id: `${id}-a`, x, y },
    { id: `${id}-b`, x: x + size, y },
    { id: `${id}-c`, x: x + size, y: y + size },
    { id: `${id}-d`, x, y: y + size },
  ];
  return {
    subpaths: [
      {
        closed: true,
        anchors: corners.map((corner) => ({
          id: corner.id,
          position: { x: corner.x, y: corner.y },
          handleIn: null,
          handleOut: null,
        })),
        segments: [
          { id: `${id}-0`, kind: 'line', fromId: corners[0].id, toId: corners[1].id },
          { id: `${id}-1`, kind: 'line', fromId: corners[1].id, toId: corners[2].id },
          { id: `${id}-2`, kind: 'line', fromId: corners[2].id, toId: corners[3].id },
          { id: `${id}-3`, kind: 'line', fromId: corners[3].id, toId: corners[0].id },
        ],
      },
    ],
  };
}

function shape(id: string, source: SourcePath, modifiers: readonly Modifier[]): VectorObject {
  return {
    id,
    name: id,
    layerId: 'layer',
    visible: true,
    locked: false,
    source,
    style: { fill: '#cccccc', stroke: null, strokeWidth: 1, fillRule: 'nonzero' },
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
    modifiers,
  };
}

function translatePath(source: SourcePath, dx: number, dy: number): SourcePath {
  return {
    subpaths: source.subpaths.map((subpath) => ({
      ...subpath,
      anchors: subpath.anchors.map((anchor) => ({
        ...anchor,
        position: { x: anchor.position.x + dx, y: anchor.position.y + dy },
      })),
    })),
  };
}

function ringArea(subpath: SourcePath['subpaths'][number]): number {
  const points = subpath.anchors.map((anchor) => anchor.position);
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const current = points[index];
    if (!current || !next) {
      continue;
    }
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function distanceToPolyline(point: Vec2, points: readonly Vec2[]): number {
  let best = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) {
      continue;
    }
    best = Math.min(best, distanceToSegment(point, start, end));
  }
  return best;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
