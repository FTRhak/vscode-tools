import { createNewDocument } from './create-document';
import {
  addLayer,
  addSwatch,
  applySwatch,
  nextSeriesName,
  reorderLayer,
  setObjectStyle,
  updateLayer,
} from './document-edits';
import { Document } from './types';

describe('document edits', () => {
  it('normalizes a fill and ignores an invalid color or width', () => {
    const document = createNewDocument();
    const id = document.objects[0].id;

    const painted = setObjectStyle(document, [id], { fill: '#FF00AA', strokeWidth: 2 });
    expect(painted.objects[0].style).toMatchObject({
      fill: '#ff00aa',
      stroke: document.objects[0].style.stroke,
      strokeWidth: 2,
      fillRule: 'nonzero',
    });
    expect(setObjectStyle(painted, [id], { fill: 'red' })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeWidth: -1 })).toBe(painted);
    expect(setObjectStyle(painted, ['missing'], { fill: '#000000' })).toBe(painted);
    expect(setObjectStyle(painted, [id], { fill: painted.objects[0].style.fill })).toBe(painted);
  });

  it('adds a swatch and applies it to stroke', () => {
    const document = createNewDocument();
    const id = document.objects[0].id;

    expect(addSwatch(document, '   ', '#ff0000')).toBe(document);
    const withSwatch = addSwatch(document, ' Red ', '#FF0000');
    const swatch = withSwatch.swatches[0];
    expect(swatch).toMatchObject({ name: 'Red', color: '#ff0000' });
    expect(applySwatch(withSwatch, 'missing', 'fill', [id])).toBe(withSwatch);
    expect(applySwatch(withSwatch, swatch.id, 'stroke', [])).toBe(withSwatch);

    const applied = applySwatch(withSwatch, swatch.id, 'stroke', [id]);
    expect(applied.objects[0].style.stroke).toBe('#ff0000');
    expect(applied.objects[0].style.fill).toBe(document.objects[0].style.fill);
  });

  it('adds, renames, and reorders layers from front to back', () => {
    const document = createNewDocument();
    const backId = document.layers[0].id;

    const added = addLayer(document);
    const front = added.layers.find((layer) => layer.id !== backId);
    expect(front).toMatchObject({ name: 'Layer 2', visible: true, locked: false, order: 1 });
    expect(nextSeriesName(['Swatch'], 'Swatch')).toBe('Swatch 2');

    expect(updateLayer(added, backId, { name: '   ' })).toBe(added);
    expect(updateLayer(added, 'missing', { name: 'Other' })).toBe(added);
    const renamed = updateLayer(added, backId, { name: ' Ink ', visible: false });
    expect(renamed.layers.find((layer) => layer.id === backId)).toMatchObject({
      name: 'Ink',
      visible: false,
    });

    const frontId = front?.id ?? '';
    expect(reorderLayer(renamed, frontId, 0)).toBe(renamed);
    expect(reorderLayer(renamed, frontId, 1.5)).toBe(renamed);
    const reordered = reorderLayer(renamed, frontId, 1);
    expect(reordered.layers.find((layer) => layer.id === frontId)?.order).toBe(0);
    expect(reordered.layers.find((layer) => layer.id === backId)?.order).toBe(1);
    expect(reorderLayer(reordered, frontId, 99)).toBe(reordered);
  });
});

describe('layer flags leave the rest of the document', () => {
  it('does not invent a document when the patch is empty', () => {
    const document = emptyDocument();
    expect(updateLayer(document, 'layer', {})).toBe(document);
  });
});

function emptyDocument(): Document {
  return {
    id: 'doc',
    name: 'Doc',
    viewBox: { x: 0, y: 0, width: 10, height: 10 },
    layers: [{ id: 'layer', name: 'Layer', visible: true, locked: false, order: 0 }],
    objects: [],
    swatches: [],
  };
}
