import { createNewDocument } from '../create-document/create-document';
import { addEmptyPoint, isEmptyPoint } from '.';

describe('addEmptyPoint', () => {
  it('places a named empty point on the selected layer', () => {
    const document = createNewDocument();
    const created = addEmptyPoint(document, { x: 12, y: 34 }, document.layers[0].id);

    expect(created).not.toBeNull();
    const point = created?.document.objects.find((object) => object.id === created.objectId);
    expect(point).toMatchObject({
      name: 'Empty Point',
      kind: 'empty',
      layerId: document.layers[0].id,
      source: { subpaths: [] },
      modifiers: [],
      style: { fill: null, stroke: null, strokeWidth: 0 },
      transform: { x: 12, y: 34, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    expect(point && isEmptyPoint(point)).toBe(true);
  });

  it('numbers further points and refuses a locked layer', () => {
    const document = createNewDocument();
    const layerId = document.layers[0].id;
    const first = addEmptyPoint(document, { x: 1, y: 1 }, layerId);
    const second = first && addEmptyPoint(first.document, { x: 2, y: 2 }, layerId);
    expect(second?.document.objects.at(-1)?.name).toBe('Empty Point 2');

    const locked = {
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, locked: true })),
    };
    expect(addEmptyPoint(locked, { x: 0, y: 0 }, layerId)).toBeNull();
    expect(addEmptyPoint(document, { x: Number.NaN, y: 0 }, layerId)).toBeNull();
  });
});
