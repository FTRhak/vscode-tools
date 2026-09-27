import { createNewDocument, Document, VectorObject } from '@vector-editor/core';
import { hitTestObject, objectsInRect } from './hit-test';

describe('hitTestObject', () => {
  it('hits the interior of the new-document curve and misses the outside', () => {
    const document = createNewDocument();
    const id = document.objects[0].id;

    expect(hitTestObject(document, { x: 450, y: 400 }, 1)).toBe(id);
    expect(hitTestObject(document, { x: 0, y: 0 }, 1)).toBeNull();
  });

  it('hits a stroke outside the fill and misses beyond it', () => {
    const document = doc([square('box')]);

    expect(hitTestObject(document, { x: 5, y: 5 }, 1)).toBe('box');
    expect(hitTestObject(document, { x: 11, y: 5 }, 1)).toBe('box');
    expect(hitTestObject(document, { x: 14, y: 5 }, 1)).toBeNull();
  });

  it('prefers the front object and skips hidden ones', () => {
    const back = square('back');
    const front = square('front');
    const hidden = { ...square('hidden'), visible: false };

    expect(hitTestObject(doc([back, front]), { x: 5, y: 5 }, 1)).toBe('front');
    expect(hitTestObject(doc([back, hidden]), { x: 5, y: 5 }, 1)).toBe('back');
    const document = createNewDocument();
    const hiddenLayer = {
      ...document,
      layers: [{ ...document.layers[0], visible: false }],
    };
    expect(hitTestObject(hiddenLayer, { x: 450, y: 400 }, 1)).toBeNull();
  });

  it('follows translation, rotation, and a zero scale', () => {
    const moved = {
      ...square('moved'),
      transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };
    const turned = {
      ...square('turned'),
      style: { ...square('turned').style, stroke: null, strokeWidth: 0 },
      transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 },
    };
    const flat = {
      ...square('flat'),
      transform: { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 1 },
    };

    expect(hitTestObject(doc([moved]), { x: 105, y: 5 }, 1)).toBe('moved');
    expect(hitTestObject(doc([turned]), { x: -5, y: 5 }, 1)).toBe('turned');
    expect(hitTestObject(doc([flat]), { x: 5, y: 5 }, 1)).toBeNull();
  });
});

describe('objectsInRect', () => {
  it('returns intersecting objects in paint order, including a reversed marquee', () => {
    const document = doc([square('box')]);

    expect(objectsInRect(document, { x: -1, y: -1, width: 6, height: 6 })).toEqual(['box']);
    expect(objectsInRect(document, { x: 4, y: 4, width: -6, height: -6 })).toEqual(['box']);
    expect(objectsInRect(document, { x: 30, y: 30, width: 4, height: 4 })).toEqual([]);
    expect(objectsInRect(document, { x: 11, y: 5, width: 1, height: 1 })).toEqual(['box']);
  });
});

function square(id: string): VectorObject {
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
    style: { fill: '#cccccc', stroke: '#111111', strokeWidth: 4, fillRule: 'nonzero' },
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
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
  };
}
