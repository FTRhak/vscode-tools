import { ObjectTransform, SourcePath } from '@vector-editor/core';
import { anchorHitRadius, hitTestAnchor } from './anchor-hit';

const identity: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
};

describe('hitTestAnchor', () => {
  const source: SourcePath = {
    subpaths: [
      {
        closed: false,
        anchors: [
          {
            id: 'a',
            position: { x: 0, y: 0 },
            handleIn: null,
            handleOut: { x: 20, y: 0 },
          },
        ],
        segments: [],
      },
    ],
  };

  it('prefers the anchor when the point is inside its radius', () => {
    expect(hitTestAnchor(source, { x: 3, y: 0 }, 6)).toEqual({ kind: 'anchor', anchorId: 'a' });
  });

  it('hits a handle that sits beyond the anchor radius', () => {
    expect(hitTestAnchor(source, { x: 20, y: 0 }, 6)).toEqual({
      kind: 'handle',
      anchorId: 'a',
      slot: 'out',
    });
    expect(hitTestAnchor(source, { x: 40, y: 0 }, 6)).toBeNull();
  });

  it('keeps the hit radius at 6 screen pixels as zoom grows', () => {
    expect(anchorHitRadius(1, identity)).toBe(6);
    expect(anchorHitRadius(2, identity)).toBe(3);
    expect(hitTestAnchor(source, { x: 4, y: 0 }, anchorHitRadius(1, identity))?.kind).toBe('anchor');
    expect(hitTestAnchor(source, { x: 4, y: 0 }, anchorHitRadius(2, identity))).toBeNull();
  });
});
