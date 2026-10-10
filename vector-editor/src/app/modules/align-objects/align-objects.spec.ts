import { Document, Modifier, svgStrokeDefaults, VectorObject } from '@vector-editor/core';
import { documentBounds } from '../eval/bounds';
import { alignObjects } from '.';

const identity = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 };

describe('alignObjects', () => {
  it('moves objects to the left edge of the selection', () => {
    const left = rect('left', 0, 4, 10, 10);
    const right = rect('right', 30, 8, 10, 12);
    const result = alignObjects(doc([left, right]), [left.id, right.id], 'left', 'selection');

    expect(result.objects[0]).toBe(left);
    expect(result.objects[1].transform).toEqual({ ...right.transform, x: 0 });
  });

  it('aligns an image by its frame', () => {
    const box = rect('box', 0, 0, 10, 10);
    const image: VectorObject = {
      ...object('image', 30, 8, { subpaths: [] }),
      kind: 'image',
      image: {
        placement: 'embed',
        fileName: 'photo.png',
        mime: 'image/png',
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        pixelWidth: 1,
        pixelHeight: 1,
        width: 10,
        height: 4,
        preserveAspectRatio: 'none',
      },
    };
    const result = alignObjects(doc([box, image]), [box.id, image.id], 'left', 'selection');

    expect(result.objects[1].transform.x).toBe(0);
    expect(result.objects[1].image).toBe(image.image);
  });

  it('aligns the other objects to the first selected object', () => {
    const left = rect('left', 0, 0, 10, 10);
    const right = rect('right', 30, 4, 10, 10);
    const locked = { ...rect('locked', 80, 0, 10, 10), locked: true };
    const document = doc([left, right, locked]);

    const toRight = alignObjects(document, [right.id, left.id, locked.id], 'left', 'first');
    expect(toRight.objects[0].transform.x).toBe(30);
    expect(toRight.objects[1]).toBe(right);
    expect(toRight.objects[2]).toBe(locked);

    expect(alignObjects(document, [right.id], 'left', 'first')).toBe(document);
  });

  it('aligns centers to the selection bounding box', () => {
    const left = rect('left', 0, 0, 10, 10);
    const right = rect('right', 30, 0, 10, 10);
    const result = alignObjects(
      doc([left, right]),
      [left.id, right.id],
      'horizontalCenter',
      'selection',
    );

    expect(result.objects.map((object) => object.transform.x)).toEqual([15, 15]);
    expect(result.objects.map((object) => object.transform.y)).toEqual([0, 0]);
  });

  it('aligns one object to the artboard and ignores a single object against the selection', () => {
    const box = rect('box', 20, 12, 10, 10);
    const artboard = doc([box], { x: 5, y: 8, width: 100, height: 40 });

    expect(alignObjects(artboard, [box.id], 'left', 'selection')).toBe(artboard);
    const result = alignObjects(artboard, [box.id], 'left', 'artboard');
    expect(result.objects[0].transform).toEqual({ ...box.transform, x: 5 });
  });

  it('leaves a locked object in place', () => {
    const locked = { ...rect('locked', 40, 0, 10, 10), locked: true };
    const anchor = rect('anchor', 0, 0, 10, 10);
    const free = rect('free', 30, 0, 10, 10);
    const result = alignObjects(
      doc([locked, anchor, free]),
      [locked.id, anchor.id, free.id],
      'left',
      'selection',
    );

    expect(result.objects[0]).toBe(locked);
    expect(result.objects[1]).toBe(anchor);
    expect(result.objects[2].transform.x).toBe(0);
  });

  it('leaves an object on a locked layer in place', () => {
    const blocked = rect('blocked', 40, 0, 10, 10);
    const free = { ...rect('free', 20, 0, 10, 10), layerId: 'open' };
    const document: Document = {
      ...doc([blocked, free], { x: 2, y: 0, width: 80, height: 40 }, true),
      layers: [
        { id: 'layer', name: 'Layer', visible: true, locked: true, order: 0 },
        { id: 'open', name: 'Open', visible: true, locked: false, order: 1 },
      ],
    };
    const result = alignObjects(document, [blocked.id, free.id], 'left', 'artboard');

    expect(result.objects[0]).toBe(blocked);
    expect(result.objects[1].transform.x).toBe(2);
  });

  it('shifts a rotated object along one axis and keeps its rotation', () => {
    const turned = {
      ...rect('turned', 0, 0, 10, 20),
      transform: { ...identity, rotation: 90 },
    };
    const other = rect('other', 10, 4, 10, 10);
    const result = alignObjects(doc([turned, other]), [turned.id, other.id], 'left', 'selection');

    expect(result.objects[0]).toBe(turned);
    expect(result.objects[1].transform).toEqual({ ...other.transform, x: -20 });
    expect(result.objects[1].transform.rotation).toBe(0);
  });

  it('aligns a cubic to the flattened curve instead of its handles', () => {
    const curve = cubic('curve');
    const box = rect('box', 0, 0, 10, 10);
    const bounds = documentBounds(curve);
    const result = alignObjects(doc([curve, box]), [curve.id, box.id], 'bottom', 'selection');

    expect(bounds?.maxY).toBeGreaterThan(25);
    expect(bounds?.maxY).toBeLessThan(35);
    expect(result.objects[0]).toBe(curve);
    expect(result.objects[1].transform.y).toBe((bounds?.maxY ?? 0) - 10);
  });

  it('moves an empty point to the path edge and still moves a hidden object', () => {
    const box = rect('box', 0, 0, 10, 20);
    const point = empty('point', 40, 6);
    const hidden = { ...rect('hidden', 25, 0, 8, 8), visible: false };
    const withPoint = alignObjects(doc([box, point]), [box.id, point.id], 'left', 'selection');
    const withHidden = alignObjects(doc([box, hidden]), [box.id, hidden.id], 'left', 'selection');

    expect(withPoint.objects[0]).toBe(box);
    expect(withPoint.objects[1].transform).toEqual({ ...point.transform, x: 0 });
    expect(withHidden.objects[1].transform.x).toBe(0);
  });

  it('uses evaluated array copies when measuring the selection', () => {
    const copies = {
      ...rect('copies', 0, 0, 10, 10),
      modifiers: [arrayModifier()],
    };
    const far = rect('far', 100, 0, 10, 10);
    const result = alignObjects(doc([copies, far]), [copies.id, far.id], 'right', 'selection');

    expect(result.objects[0].transform.x).toBe(80);
    expect(result.objects[1]).toBe(far);
  });

  it('returns the same document when every edge already matches', () => {
    const left = rect('left', 0, 0, 10, 10);
    const right = rect('right', 0, 20, 8, 8);
    const document = doc([left, right]);

    expect(alignObjects(document, [left.id, right.id], 'left', 'selection')).toBe(document);
  });
});

function arrayModifier(): Modifier {
  return { id: 'array', type: 'array', count: 2, offsetX: 20, offsetY: 0, enabled: true };
}

function rect(id: string, x: number, y: number, width: number, height: number): VectorObject {
  const anchors = [
    corner(`${id}-0`, 0, 0),
    corner(`${id}-1`, width, 0),
    corner(`${id}-2`, width, height),
    corner(`${id}-3`, 0, height),
  ];
  return object(id, x, y, {
    subpaths: [
      {
        closed: true,
        anchors,
        segments: [
          line(`${id}-s0`, anchors[0].id, anchors[1].id),
          line(`${id}-s1`, anchors[1].id, anchors[2].id),
          line(`${id}-s2`, anchors[2].id, anchors[3].id),
          line(`${id}-s3`, anchors[3].id, anchors[0].id),
        ],
      },
    ],
  });
}

function cubic(id: string): VectorObject {
  const start = {
    id: `${id}-a`,
    position: { x: 0, y: 0 },
    handleIn: null,
    handleOut: { x: 0, y: 40 },
  };
  const end = {
    id: `${id}-b`,
    position: { x: 10, y: 0 },
    handleIn: { x: 10, y: 40 },
    handleOut: null,
  };
  return object(id, 0, 0, {
    subpaths: [
      {
        closed: false,
        anchors: [start, end],
        segments: [{ id: `${id}-s`, kind: 'cubic', fromId: start.id, toId: end.id }],
      },
    ],
  });
}

function empty(id: string, x: number, y: number): VectorObject {
  return { ...object(id, x, y, { subpaths: [] }), kind: 'empty' };
}

function object(
  id: string,
  x: number,
  y: number,
  source: VectorObject['source'],
): VectorObject {
  return {
    id,
    name: id,
    layerId: 'layer',
    visible: true,
    locked: false,
    kind: 'path',
    source,
    style: {
      ...svgStrokeDefaults,
      fill: '#fff',
      stroke: null,
      strokeWidth: 1,
      fillRule: 'nonzero',
    },
    transform: { ...identity, x, y },
    modifiers: [],
  };
}

function corner(id: string, x: number, y: number) {
  return { id, position: { x, y }, handleIn: null, handleOut: null };
}

function line(id: string, fromId: string, toId: string) {
  return { id, kind: 'line' as const, fromId, toId };
}

function doc(
  objects: readonly VectorObject[],
  viewBox: Document['viewBox'] = { x: 0, y: 0, width: 100, height: 80 },
  layerLocked = false,
): Document {
  return {
    id: 'doc',
    name: 'Doc',
    viewBox,
    layers: [{ id: 'layer', name: 'Layer', visible: true, locked: layerLocked, order: 0 }],
    objects,
    swatches: [],
    gradients: [],
  };
}
