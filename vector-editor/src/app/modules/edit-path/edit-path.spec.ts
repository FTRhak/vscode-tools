import { Anchor, Segment, SourcePath, Vec2 } from '../types/types';
import {
  anchorPointType,
  deleteAnchors,
  insertPoint,
  setAnchorHandle,
  setAnchorPointType,
  setAnchorPosition,
  translateAnchors,
} from '.';

describe('edit path', () => {
  it('moves an anchor together with both handles', () => {
    const source = path([
      anchor('a', 0, 0, { x: -10, y: 0 }, { x: 10, y: 0 }),
      anchor('b', 20, 0, null, null),
    ]);

    const next = translateAnchors(source, ['a'], 3, -2);
    const moved = next.subpaths[0].anchors[0];

    expect(moved.position).toEqual({ x: 3, y: -2 });
    expect(moved.handleIn).toEqual({ x: -7, y: -2 });
    expect(moved.handleOut).toEqual({ x: 13, y: -2 });
    expect(next.subpaths[0].anchors[1]).toBe(source.subpaths[0].anchors[1]);
    expect(translateAnchors(source, ['a'], 0, 0)).toBe(source);
  });

  it('shifts handles by the same delta as an absolute anchor position', () => {
    const source = path([anchor('a', 0, 0, { x: 1, y: 2 }, { x: 3, y: 4 })]);

    const next = setAnchorPosition(source, ['a'], { x: 5 });

    expect(next.subpaths[0].anchors[0]).toMatchObject({
      position: { x: 5, y: 0 },
      handleIn: { x: 6, y: 2 },
      handleOut: { x: 8, y: 4 },
    });
  });

  it('mirrors an existing opposite handle and does not invent a missing one', () => {
    const linked = path([anchor('a', 0, 0, { x: -4, y: 0 }, { x: 4, y: 2 })]);
    const mirrored = setAnchorHandle(linked, ['a'], 'out', { x: 6, y: 0 }, false);
    expect(mirrored.subpaths[0].anchors[0].handleOut).toEqual({ x: 6, y: 0 });
    expect(mirrored.subpaths[0].anchors[0].handleIn).toEqual({ x: -6, y: 0 });

    const open = path([anchor('a', 0, 0, null, { x: 4, y: 0 })]);
    const alone = setAnchorHandle(open, ['a'], 'out', { x: 8, y: 1 }, false);
    expect(alone.subpaths[0].anchors[0].handleIn).toBeNull();
    expect(alone.subpaths[0].anchors[0].handleOut).toEqual({ x: 8, y: 1 });
  });

  it('leaves the opposite handle in place when the link is broken', () => {
    const source = path([anchor('a', 0, 0, { x: -4, y: 1 }, { x: 4, y: -1 })]);

    const next = setAnchorHandle(source, ['a'], 'out', { x: 9, y: 3 }, true);

    expect(next.subpaths[0].anchors[0].handleOut).toEqual({ x: 9, y: 3 });
    expect(next.subpaths[0].anchors[0].handleIn).toEqual({ x: -4, y: 1 });
  });

  it('converts a line point into corner, smooth, and symmetric handles', () => {
    const source = path(
      [anchor('a', 0, 0, null, null), anchor('b', 90, 0, null, null)],
      [segment('ab', 'line', 'a', 'b')],
    );

    const corner = setAnchorPointType(source, ['a'], 'corner');
    expect(corner.subpaths[0].anchors[0]).toMatchObject({
      handleIn: null,
      handleOut: { x: 30, y: 0 },
    });
    expect(anchorPointType(corner.subpaths[0].anchors[0])).toBe('corner');
    expect(corner.subpaths[0].segments[0].kind).toBe('cubic');
    expect(corner.subpaths[0].anchors[1]).toBe(source.subpaths[0].anchors[1]);

    const smooth = setAnchorPointType(source, ['a'], 'smooth');
    expect(smooth.subpaths[0].anchors[0]).toMatchObject({
      handleIn: { x: -32, y: 0 },
      handleOut: { x: 30, y: 0 },
    });
    expect(anchorPointType(smooth.subpaths[0].anchors[0])).toBe('smooth');

    const symmetric = setAnchorPointType(source, ['a'], 'symmetric');
    expect(symmetric.subpaths[0].anchors[0]).toMatchObject({
      handleIn: { x: -32, y: 0 },
      handleOut: { x: 32, y: 0 },
    });
    expect(anchorPointType(symmetric.subpaths[0].anchors[0])).toBe('symmetric');
    expect(setAnchorPointType(source, ['a'], 'line')).toBe(source);
    expect(setAnchorPointType(source, [], 'smooth')).toBe(source);
  });

  it('aligns a corner into a smooth point and breaks a smooth point into a corner', () => {
    const kink = path(
      [anchor('a', 0, 0, { x: 0, y: -10 }, { x: 30, y: 0 }), anchor('b', 40, 0, null, null)],
      [segment('ab', 'cubic', 'a', 'b')],
    );
    expect(anchorPointType(kink.subpaths[0].anchors[0])).toBe('corner');

    const smooth = setAnchorPointType(kink, ['a'], 'smooth');
    expect(smooth.subpaths[0].anchors[0]).toMatchObject({
      handleIn: { x: -10, y: 0 },
      handleOut: { x: 30, y: 0 },
    });
    expect(anchorPointType(smooth.subpaths[0].anchors[0])).toBe('smooth');
    expect(smooth.subpaths[0].segments[0]).toBe(kink.subpaths[0].segments[0]);

    const symmetric = setAnchorPointType(smooth, ['a'], 'symmetric');
    expect(symmetric.subpaths[0].anchors[0]).toMatchObject({
      handleIn: { x: -30, y: 0 },
      handleOut: { x: 30, y: 0 },
    });
    expect(anchorPointType(symmetric.subpaths[0].anchors[0])).toBe('symmetric');

    const corner = setAnchorPointType(symmetric, ['a'], 'corner');
    expect(corner.subpaths[0].anchors[0]).toMatchObject({
      handleIn: { x: -30, y: 0 },
      handleOut: { x: 0, y: 30 },
    });
    expect(anchorPointType(corner.subpaths[0].anchors[0])).toBe('corner');

    const line = setAnchorPointType(corner, ['a'], 'line');
    expect(line.subpaths[0].anchors[0]).toMatchObject({ handleIn: null, handleOut: null });
    expect(line.subpaths[0].segments[0].kind).toBe('line');
    expect(anchorPointType(line.subpaths[0].anchors[0])).toBe('line');
  });

  it('creates a handle only when both coordinates are given', () => {
    const source = path([anchor('a', 0, 0, null, null)]);

    expect(setAnchorHandle(source, ['a'], 'in', { x: 2 }, false)).toBe(source);
    expect(
      setAnchorHandle(source, ['a'], 'in', { x: 2, y: 3 }, true).subpaths[0].anchors[0].handleIn,
    ).toEqual({
      x: 2,
      y: 3,
    });
  });

  it('bridges the gap when an anchor is deleted and drops an empty subpath', () => {
    const source: SourcePath = {
      subpaths: [
        {
          closed: true,
          anchors: [
            anchor('a', 0, 0, null, null),
            anchor('b', 10, 0, null, null),
            anchor('c', 10, 10, null, null),
            anchor('d', 0, 10, null, null),
          ],
          segments: [
            segment('ab', 'line', 'a', 'b'),
            segment('bc', 'cubic', 'b', 'c'),
            segment('cd', 'line', 'c', 'd'),
            segment('da', 'line', 'd', 'a'),
          ],
        },
      ],
    };

    const next = deleteAnchors(source, ['b']);
    const subpath = next.subpaths[0];

    expect(subpath.anchors.map((item) => item.id)).toEqual(['a', 'c', 'd']);
    expect(subpath.closed).toBe(true);
    expect(subpath.segments.map((item) => [item.fromId, item.toId, item.kind])).toEqual([
      ['a', 'c', 'cubic'],
      ['c', 'd', 'line'],
      ['d', 'a', 'line'],
    ]);
    expect(subpath.segments[1]).toBe(source.subpaths[0].segments[2]);
    expect(deleteAnchors(next, ['a', 'c', 'd']).subpaths).toEqual([]);
  });

  it('splits a line and keeps the untouched anchor', () => {
    const kept = anchor('c', 0, 20, null, null);
    const source = path(
      [anchor('a', 0, 0, null, null), anchor('b', 100, 0, null, null), kept],
      [segment('ab', 'line', 'a', 'b')],
    );

    const inserted = insertPoint(source, 'ab', 0.25);

    expect(inserted?.source.subpaths[0].anchors.map((item) => item.id)).toEqual([
      'a',
      inserted?.anchorId,
      'b',
      'c',
    ]);
    expect(inserted?.source.subpaths[0].anchors[1].position).toEqual({ x: 25, y: 0 });
    expect(inserted?.source.subpaths[0].anchors[1].handleIn).toBeNull();
    expect(
      inserted?.source.subpaths[0].segments.map((item) => [item.fromId, item.toId, item.kind]),
    ).toEqual([
      ['a', inserted?.anchorId, 'line'],
      [inserted?.anchorId, 'b', 'line'],
    ]);
    expect(inserted?.source.subpaths[0].anchors[3]).toBe(kept);
    expect(insertPoint(source, 'missing', 0.5)).toBeNull();
    expect(insertPoint(source, 'ab', 0)).toBeNull();
    expect(insertPoint(source, 'ab', 1)).toBeNull();
  });

  it('splits a cubic without changing the curve', () => {
    const source = path(
      [anchor('a', 0, 0, null, { x: 0, y: 100 }), anchor('b', 100, 0, { x: 100, y: 100 }, null)],
      [segment('ab', 'cubic', 'a', 'b')],
    );

    const inserted = insertPoint(source, 'ab', 0.5);
    const anchors = inserted?.source.subpaths[0].anchors ?? [];

    expect(anchors[0]).toMatchObject({ handleIn: null, handleOut: { x: 0, y: 50 } });
    expect(anchors[1]).toMatchObject({
      position: { x: 50, y: 75 },
      handleIn: { x: 25, y: 75 },
      handleOut: { x: 75, y: 75 },
    });
    expect(anchors[2]).toMatchObject({ handleIn: { x: 100, y: 50 }, handleOut: null });
    expect(pointOnHalves(inserted!.source, 0.25)).toEqual(cubicAt(0.25));
    expect(pointOnHalves(inserted!.source, 0.75)).toEqual(cubicAt(0.75));
  });

  it('inserts on the closing segment after the last anchor', () => {
    const source = path(
      [
        anchor('a', 0, 0, null, null),
        anchor('b', 10, 0, null, null),
        anchor('c', 0, 10, null, null),
      ],
      [
        segment('ab', 'line', 'a', 'b'),
        segment('bc', 'line', 'b', 'c'),
        segment('ca', 'line', 'c', 'a'),
      ],
      true,
    );

    const inserted = insertPoint(source, 'ca', 0.5);

    expect(inserted?.source.subpaths[0].closed).toBe(true);
    expect(inserted?.source.subpaths[0].anchors.map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
      inserted?.anchorId,
    ]);
    expect(inserted?.source.subpaths[0].anchors[3].position).toEqual({ x: 0, y: 5 });
    expect(inserted?.source.subpaths[0].segments.map((item) => [item.fromId, item.toId])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
      ['c', inserted?.anchorId],
      [inserted?.anchorId, 'a'],
    ]);
  });

  it('leaves a single survivor open and without segments', () => {
    const source = path(
      [anchor('a', 0, 0, null, null), anchor('b', 1, 0, null, null)],
      [segment('ab', 'line', 'a', 'b')],
      true,
    );

    const next = deleteAnchors(source, ['b']);

    expect(next.subpaths[0]).toMatchObject({
      closed: false,
      segments: [],
      anchors: [expect.objectContaining({ id: 'a' })],
    });
  });
});

function path(
  anchors: readonly Anchor[],
  segments: readonly Segment[] = [],
  closed = false,
): SourcePath {
  return { subpaths: [{ closed, anchors, segments }] };
}

function anchor(
  id: string,
  x: number,
  y: number,
  handleIn: Vec2 | null,
  handleOut: Vec2 | null,
): Anchor {
  return { id, position: { x, y }, handleIn, handleOut };
}

function segment(id: string, kind: Segment['kind'], fromId: string, toId: string): Segment {
  return { id, kind, fromId, toId };
}

function cubicAt(t: number): Vec2 {
  const p0 = { x: 0, y: 0 };
  const p1 = { x: 0, y: 100 };
  const p2 = { x: 100, y: 100 };
  const p3 = { x: 100, y: 0 };
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function pointOnHalves(source: SourcePath, t: number): Vec2 {
  const anchors = source.subpaths[0].anchors;
  const [from, middle, to] = anchors;
  if (t <= 0.5) {
    return cubicSample(
      from.position,
      from.handleOut ?? from.position,
      middle.handleIn ?? middle.position,
      middle.position,
      t / 0.5,
    );
  }
  return cubicSample(
    middle.position,
    middle.handleOut ?? middle.position,
    to.handleIn ?? to.position,
    to.position,
    (t - 0.5) / 0.5,
  );
}

function cubicSample(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}
