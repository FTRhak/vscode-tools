import { createNewDocument } from '../create-document';
import {
  addLayer,
  addPath,
  addSwatch,
  applySwatch,
  createGradient,
  nextSeriesName,
  reorderLayer,
  setObjectStyle,
  updateLayer,
} from '.';
import { Document } from '../types/types';

describe('document edits', () => {
  it('creates a gradient and applies it to the requested paint slot', () => {
    const document = createNewDocument();
    const objectId = document.objects[0].id;

    const definition = {
      name: 'Sunset',
      type: 'radial' as const,
      angle: 35,
      proportions: 1.4,
      stops: [
        { id: 'stop-a', offset: 0, color: '#FF0000', opacity: 1 },
        { id: 'stop-b', offset: 0.5, color: '#00FF00', opacity: 0.4 },
        { id: 'stop-c', offset: 1, color: '#0000FF', opacity: 0.8 },
      ],
    };
    const updated = createGradient(document, definition, 'fill', [objectId]);
    const gradient = updated.gradients[0];

    expect(gradient).toMatchObject({
      name: 'Sunset',
      type: 'radial',
      proportions: 1.4,
      stops: [
        { id: 'stop-a', color: '#ff0000', opacity: 1 },
        { id: 'stop-b', color: '#00ff00', opacity: 0.4 },
        { id: 'stop-c', color: '#0000ff', opacity: 0.8 },
      ],
    });
    expect(updated.objects[0].style.fill).toBe(`url(#${gradient?.id})`);
    expect(updated.objects[0].style.stroke).toBe(document.objects[0].style.stroke);
    expect(createGradient(document, { ...definition, name: ' ' }, 'fill', [objectId])).toBe(
      document,
    );
  });

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

  it('patches stroke paint and ignores invalid values', () => {
    const document = createNewDocument();
    const id = document.objects[0].id;

    const painted = setObjectStyle(document, [id], {
      strokeLinecap: 'round',
      strokeLinejoin: 'bevel',
      strokeMiterlimit: 2,
      strokeOpacity: 0.5,
      strokeDasharray: [4, 1, 2],
      strokeDashoffset: -3,
    });
    expect(painted.objects[0].style).toMatchObject({
      strokeLinecap: 'round',
      strokeLinejoin: 'bevel',
      strokeMiterlimit: 2,
      strokeOpacity: 0.5,
      strokeDasharray: [4, 1, 2],
      strokeDashoffset: -3,
    });
    expect(setObjectStyle(painted, [id], { strokeLinecap: 'round' })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeDasharray: [4, 1, 2] })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeMiterlimit: 0.5 })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeOpacity: 1.2 })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeDasharray: [1, -1] })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeDashoffset: Number.NaN })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeLinecap: 'arcs' as 'butt' })).toBe(painted);
    expect(setObjectStyle(painted, [id], { strokeAlign: 'center' as 'default' })).toBe(painted);

    const aligned = setObjectStyle(painted, [id], { strokeAlign: 'inside' });
    expect(aligned.objects[0].style.strokeAlign).toBe('inside');
    expect(setObjectStyle(aligned, [id], { strokeAlign: 'inside' })).toBe(aligned);
    expect(
      setObjectStyle(aligned, [id], { strokeAlign: 'outside' }).objects[0].style.strokeAlign,
    ).toBe('outside');

    const cleared = setObjectStyle(painted, [id], { strokeDasharray: [] });
    expect(cleared.objects[0].style.strokeDasharray).toBeNull();
    expect(setObjectStyle(cleared, [id], { strokeDasharray: null })).toBe(cleared);
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

  it('adds a closed path on the requested layer', () => {
    const document = createNewDocument();
    const layerId = document.layers[0].id;

    expect(addPath(document, 'missing')).toBeNull();
    expect(
      addPath({ ...document, layers: [{ ...document.layers[0], locked: true }] }, layerId),
    ).toBeNull();
    expect(
      addPath({ ...document, layers: [{ ...document.layers[0], visible: false }] }, layerId),
    ).toBeNull();

    const created = addPath(document, layerId);
    const object = created?.document.objects.at(-1);
    expect(created?.objectId).toBe(object?.id);
    expect(object).toMatchObject({
      name: 'Path 2',
      layerId,
      visible: true,
      locked: false,
      style: { fill: '#c5d4f0', stroke: '#1a1a1a', strokeWidth: 4 },
    });
    expect(object?.source.subpaths).toEqual([
      {
        closed: true,
        anchors: [
          expect.objectContaining({ position: { x: 524, y: 354 } }),
          expect.objectContaining({ position: { x: 724, y: 354 } }),
          expect.objectContaining({ position: { x: 724, y: 494 } }),
          expect.objectContaining({ position: { x: 524, y: 494 } }),
        ],
        segments: [
          expect.objectContaining({ kind: 'line' }),
          expect.objectContaining({ kind: 'line' }),
          expect.objectContaining({ kind: 'line' }),
          expect.objectContaining({ kind: 'line' }),
        ],
      },
    ]);
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
    gradients: [],
  };
}
