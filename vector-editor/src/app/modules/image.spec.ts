import { createNewDocument } from './create-document';
import { duplicateObjects } from './duplicate-objects';
import { addModifier } from './modifier-edits';
import { addImage, isImage, type ImageDraft } from './image';

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function draft(patch: Partial<ImageDraft> = {}): ImageDraft {
  return {
    name: 'Photo',
    placement: 'embed',
    fileName: 'photo.png',
    mime: 'image/png',
    dataUrl: pixel,
    pixelWidth: 1,
    pixelHeight: 1,
    x: 12,
    y: 20,
    width: 40,
    height: 30,
    preserveAspectRatio: 'xMidYMid meet',
    ...patch,
  };
}

describe('addImage', () => {
  it('places a named image on the selected layer', () => {
    const document = createNewDocument();
    const created = addImage(document, draft(), document.layers[0].id);

    expect(created).not.toBeNull();
    const image = created?.document.objects.find((object) => object.id === created.objectId);
    expect(image).toMatchObject({
      name: 'Photo',
      kind: 'image',
      layerId: document.layers[0].id,
      source: { subpaths: [] },
      modifiers: [],
      transform: { x: 12, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      image: {
        placement: 'embed',
        fileName: 'photo.png',
        width: 40,
        height: 30,
        preserveAspectRatio: 'xMidYMid meet',
      },
    });
    expect(image && isImage(image)).toBe(true);
  });

  it('numbers further images and refuses a locked or hidden layer', () => {
    const document = createNewDocument();
    const layerId = document.layers[0].id;
    const first = addImage(document, draft(), layerId);
    const second = first && addImage(first.document, draft({ name: 'Photo' }), layerId);
    expect(second?.document.objects.at(-1)?.name).toBe('Photo 2');

    const locked = {
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, locked: true })),
    };
    const hidden = {
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, visible: false })),
    };
    expect(addImage(locked, draft(), layerId)).toBeNull();
    expect(addImage(hidden, draft(), layerId)).toBeNull();
    expect(addImage(document, draft({ width: 0 }), layerId)).toBeNull();
    expect(addImage(document, draft({ dataUrl: 'https://example.test/a.png' }), layerId)).toBeNull();
  });

  it('copies the image and refuses modifiers', () => {
    const document = createNewDocument();
    const created = addImage(document, draft({ placement: 'link' }), document.layers[0].id);
    expect(created).not.toBeNull();
    const source = created!.document.objects.find((object) => object.id === created!.objectId)!;
    const duplicated = duplicateObjects(created!.document, [source.id]);
    const copy = duplicated?.document.objects.at(-1);
    expect(copy?.image).toEqual(source.image);
    expect(copy?.transform).toMatchObject({ x: 36, y: 44 });
    expect(addModifier(source, 'array')).toBe(source);
  });
});
