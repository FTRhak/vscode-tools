import { Anchor, Segment, SourcePath, Vec2 } from './types';
import { deleteAnchors, setAnchorHandle, setAnchorPosition, translateAnchors } from './edit-path';

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
