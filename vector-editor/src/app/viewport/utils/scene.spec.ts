import { Document, svgStrokeDefaults, VectorObject } from '@vector-editor/core';
import { sceneFromDocument } from './scene';

describe('sceneFromDocument', () => {
  it('paints a closed stroke inside or outside and keeps an open stroke centered', () => {
    const inside = sceneFromDocument(doc([square('box', 'inside')]), null, 'viewport').objects[0];
    expect(inside?.strokeAlign).toBe('inside');
    expect(inside?.clipId).toBe('stroke-clip-viewport-box');
    expect(inside?.maskId).toBeNull();
    expect(inside?.strokeWidth).toBe(4);

    const outside = sceneFromDocument(doc([square('box', 'outside')]), null, 'preview').objects[0];
    expect(outside?.strokeAlign).toBe('outside');
    expect(outside?.maskId).toBe('stroke-mask-preview-box');
    expect(outside?.clipId).toBeNull();
    expect(outside?.maskRect).toEqual({ x: -4, y: -4, width: 18, height: 18 });

    const open = sceneFromDocument(
      doc([
        {
          ...square('open', 'inside'),
          source: {
            subpaths: [{ ...square('open', 'inside').source.subpaths[0], closed: false }],
          },
        },
      ]),
    ).objects[0];
    expect(open?.strokeAlign).toBe('default');
    expect(open?.clipId).toBeNull();

    const bare = sceneFromDocument(
      doc([
        {
          ...square('bare', 'outside'),
          style: { ...square('bare', 'outside').style, stroke: null },
        },
      ]),
    ).objects[0];
    expect(bare?.strokeAlign).toBe('default');
  });
});

function square(id: string, strokeAlign: 'default' | 'inside' | 'outside'): VectorObject {
  const anchors = [
    anchor(`${id}-a`, 0, 0),
    anchor(`${id}-b`, 10, 0),
    anchor(`${id}-c`, 10, 10),
    anchor(`${id}-d`, 0, 10),
  ];
  return {
    id,
    name: id,
    layerId: 'layer',
    visible: true,
    locked: false,
    source: {
      subpaths: [
        {
          closed: true,
          anchors,
          segments: [
            segment(`${id}-0`, anchors[0].id, anchors[1].id),
            segment(`${id}-1`, anchors[1].id, anchors[2].id),
            segment(`${id}-2`, anchors[2].id, anchors[3].id),
            segment(`${id}-3`, anchors[3].id, anchors[0].id),
          ],
        },
      ],
    },
    style: {
      ...svgStrokeDefaults,
      fill: '#cccccc',
      stroke: '#111111',
      strokeWidth: 4,
      strokeAlign,
      fillRule: 'nonzero',
    },
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
    modifiers: [],
  };
}

function anchor(id: string, x: number, y: number) {
  return { id, position: { x, y }, handleIn: null, handleOut: null };
}

function segment(id: string, fromId: string, toId: string) {
  return { id, kind: 'line' as const, fromId, toId };
}

function doc(objects: readonly VectorObject[]): Document {
  return {
    id: 'doc',
    name: 'Doc',
    viewBox: { x: 0, y: 0, width: 200, height: 200 },
    layers: [{ id: 'layer', name: 'Layer', visible: true, locked: false, order: 0 }],
    objects,
    swatches: [],
    gradients: [],
  };
}
