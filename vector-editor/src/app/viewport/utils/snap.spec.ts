import { Document, VectorObject } from '@vector-editor/core';
import { anchorSnapSources, collectSnapTargets, snapToGrid, snapToPoints, snapTranslation } from './snap';

describe('snap', () => {
  it('rounds positions onto each grid step', () => {
    expect(snapToGrid({ x: 10.4, y: -1.6 }, 1)).toEqual({ x: 10, y: -2 });
    expect(snapToGrid({ x: 1.26, y: 0.04 }, 0.1)).toEqual({ x: 1.3, y: 0 });
    expect(snapToGrid({ x: 1.234, y: 8.005 }, 0.01)).toEqual({ x: 1.23, y: 8.01 });
  });

  it('jumps to the nearest point inside the threshold', () => {
    expect(snapToPoints({ x: 3, y: 1 }, [{ x: 10, y: 10 }, { x: 4, y: 1 }], 8)).toEqual({
      x: 4,
      y: 1,
    });
    expect(snapToPoints({ x: 3, y: 1 }, [{ x: 40, y: 40 }], 8)).toEqual({ x: 3, y: 1 });
  });

  it('keeps a free move when no object point is close enough', () => {
    const delta = snapTranslation(
      { x: 12, y: 3 },
      [{ start: { x: 0, y: 0 } }],
      'object',
      [{ x: 40, y: 40 }],
      8,
    );
    expect(delta).toEqual({ x: 12, y: 3 });
  });

  it('pulls the closest object point onto a target', () => {
    const delta = snapTranslation(
      { x: 2, y: 1 },
      [
        { start: { x: 0, y: 0 } },
        { start: { x: 100, y: 0 } },
      ],
      'layer',
      [{ x: 104, y: 2 }],
      8,
    );
    expect(delta).toEqual({ x: 4, y: 2 });
  });

  it('snaps the reference point onto the grid', () => {
    const delta = snapTranslation(
      { x: 10.4, y: 0.2 },
      [
        { start: { x: 3, y: 5 } },
        { start: { x: 80, y: 80 } },
      ],
      'grid_100',
      [],
      8,
    );
    expect(delta).toEqual({ x: 10, y: 0 });
  });

  it('collects same-layer points for object mode and every layer for layer mode', () => {
    const document = sampleDocument();
    expect(collectSnapTargets(document, 'object', new Set(['a']), 'layer-a')).toEqual([
      { x: 10, y: 0 },
      { x: 12, y: 0 },
      { x: 14, y: 0 },
    ]);
    expect(collectSnapTargets(document, 'layer', new Set(['a']), 'layer-a')).toEqual([
      { x: 10, y: 0 },
      { x: 12, y: 0 },
      { x: 14, y: 0 },
      { x: 30, y: 8 },
      { x: 30, y: 8 },
      { x: 30, y: 8 },
    ]);
  });

  it('lists the dragged anchor before the other selected anchors', () => {
    const object = sampleObject('a', 'layer-a', 0, 0, 4, 6);
    expect(anchorSnapSources(object, ['b', 'a'], 'b').map((source) => source.start)).toEqual([
      { x: 6, y: 0 },
      { x: 4, y: 0 },
    ]);
  });
});

function sampleDocument(): Document {
  return {
    id: 'doc',
    name: 'Doc',
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    layers: [
      { id: 'layer-a', name: 'A', visible: true, locked: false, order: 0 },
      { id: 'layer-b', name: 'B', visible: true, locked: false, order: 1 },
    ],
    objects: [
      sampleObject('a', 'layer-a', 0, 0, 4, 6),
      sampleObject('b', 'layer-a', 10, 0, 2, 4),
      sampleObject('c', 'layer-b', 30, 8, 0, 0),
    ],
    swatches: [],
    gradients: [],
  };
}

function sampleObject(
  id: string,
  layerId: string,
  x: number,
  y: number,
  anchorX: number,
  anchorY: number,
): VectorObject {
  return {
    id,
    name: id,
    layerId,
    visible: true,
    locked: false,
    source: {
      subpaths: [
        {
          closed: false,
          anchors: [
            { id: 'a', position: { x: anchorX, y: 0 }, handleIn: null, handleOut: null },
            { id: 'b', position: { x: anchorY, y: 0 }, handleIn: null, handleOut: null },
          ],
          segments: [],
        },
      ],
    },
    style: { fill: null, stroke: '#000', strokeWidth: 1, fillRule: 'nonzero' },
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
    modifiers: [],
  };
}
