import { Modifier, SourcePath, Vec2 } from '../model/types';
import { sourceBounds } from './bounds';
import { evaluateSource } from './evaluate';

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

  it('reports bevel and boolean without changing the path', () => {
    const source = path('a', { x: 0, y: 0 }, { x: 1, y: 0 }, null, null);
    const evaluated = evaluateSource(source, [
      {
        id: 'bevel',
        type: 'bevel',
        distance: 2,
        join: 'bevel',
        miterLimit: 4,
        enabled: true,
      },
      {
        id: 'bool',
        type: 'boolean',
        operation: 'difference',
        operandId: 'other',
        enabled: true,
      },
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
    expect(evaluated.diagnostics).toEqual([
      'Bevel is not available yet.',
      'Boolean is not available yet.',
    ]);
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
