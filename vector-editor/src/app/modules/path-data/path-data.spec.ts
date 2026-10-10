import { sourceToPathData } from './path-data';
import { SourcePath } from '../types';

describe('sourceToPathData', () => {
  const source: SourcePath = {
    subpaths: [
      {
        closed: false,
        anchors: [
          {
            id: 'a',
            position: { x: 0, y: 0 },
            handleIn: null,
            handleOut: { x: 10, y: 0 },
          },
          {
            id: 'b',
            position: { x: 30, y: 0 },
            handleIn: null,
            handleOut: null,
          },
          {
            id: 'c',
            position: { x: 40, y: 10 },
            handleIn: null,
            handleOut: null,
          },
        ],
        segments: [
          { id: 's1', kind: 'cubic', fromId: 'a', toId: 'b' },
          { id: 's2', kind: 'line', fromId: 'b', toId: 'c' },
        ],
      },
    ],
  };

  it('writes move, cubic, and line commands and collapses a missing handle onto the anchor', () => {
    expect(sourceToPathData(source)).toBe('M 0 0 C 10 0 30 0 30 0 L 40 10');
  });

  it('closes a subpath with Z', () => {
    const closed: SourcePath = {
      subpaths: [
        {
          ...source.subpaths[0],
          closed: true,
          anchors: source.subpaths[0].anchors,
          segments: source.subpaths[0].segments,
        },
      ],
    };

    expect(sourceToPathData(closed)).toBe('M 0 0 C 10 0 30 0 30 0 L 40 10 Z');
  });
});
