import { SourcePath } from '@vector-editor/core';
import { hitTestSegment } from './add-point';

describe('add point hit test', () => {
  const source: SourcePath = {
    subpaths: [
      {
        closed: false,
        anchors: [
          { id: 'a', position: { x: 0, y: 0 }, handleIn: null, handleOut: null },
          { id: 'b', position: { x: 100, y: 0 }, handleIn: null, handleOut: null },
          {
            id: 'c',
            position: { x: 100, y: 100 },
            handleIn: { x: 100, y: 40 },
            handleOut: null,
          },
        ],
        segments: [
          { id: 'ab', kind: 'line', fromId: 'a', toId: 'b' },
          { id: 'bc', kind: 'cubic', fromId: 'b', toId: 'c' },
        ],
      },
    ],
  };

  it('finds the interior of a line and ignores the endpoints', () => {
    expect(hitTestSegment(source, { x: 40, y: 2 }, 8)?.segmentId).toBe('ab');
    expect(hitTestSegment(source, { x: 40, y: 2 }, 8)?.t).toBeCloseTo(0.4);
    expect(hitTestSegment(source, { x: 0, y: 0 }, 8)).toBeNull();
    expect(hitTestSegment(source, { x: 40, y: 20 }, 8)).toBeNull();
  });

  it('finds a point on a cubic', () => {
    const hit = hitTestSegment(source, { x: 100, y: 50 }, 8);
    expect(hit?.segmentId).toBe('bc');
    expect(hit?.t).toBeGreaterThan(0.2);
    expect(hit?.t).toBeLessThan(0.8);
  });
});