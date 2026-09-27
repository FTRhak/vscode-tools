import { createNewDocument } from './create-document';
import { isInteractionLocked, objectsInPaintOrder } from './paint-order';

describe('objectsInPaintOrder', () => {
  it('omits a hidden object and a hidden layer separately', () => {
    const document = createNewDocument();
    const object = document.objects[0];
    const layer = document.layers[0];

    expect(objectsInPaintOrder(document).map((item) => item.id)).toEqual([object.id]);
    expect(
      objectsInPaintOrder({
        ...document,
        objects: [{ ...object, visible: false }],
      }),
    ).toEqual([]);
    expect(
      objectsInPaintOrder({
        ...document,
        layers: [{ ...layer, visible: false }],
      }),
    ).toEqual([]);
    expect(
      objectsInPaintOrder({
        ...document,
        layers: [{ ...layer, visible: false }],
        objects: [{ ...object, visible: true }],
      }),
    ).toEqual([]);
  });
});

describe('isInteractionLocked', () => {
  it('is locked by the object or by its layer', () => {
    const document = createNewDocument();
    const object = document.objects[0];
    const layer = document.layers[0];

    expect(isInteractionLocked(document, object)).toBe(false);
    expect(isInteractionLocked(document, { ...object, locked: true })).toBe(true);
    expect(isInteractionLocked({ ...document, layers: [{ ...layer, locked: true }] }, object)).toBe(
      true,
    );
  });
});
