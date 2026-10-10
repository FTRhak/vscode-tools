import { Document, Modifier, svgStrokeDefaults, VectorObject } from '../types/types';
import { deleteLayer, deleteObjects } from './delete-objects';

describe('deleteObjects', () => {
  it('removes unlocked objects and a boolean that used one as an operand', () => {
    const operand = object('operand');
    const host = object('host', [
      {
        id: 'bool',
        type: 'boolean',
        operation: 'difference',
        operandId: operand.id,
        enabled: true,
      },
      {
        id: 'mirror',
        type: 'mirror',
        axis: 'x',
        enabled: true,
      },
    ]);
    const kept = object('kept');
    const document = doc([host, operand, kept]);

    const result = deleteObjects(document, [operand.id, 'missing', operand.id]);

    expect(result?.removedIds).toEqual([operand.id]);
    expect(result?.document.objects.map((item) => item.id)).toEqual([host.id, kept.id]);
    expect(result?.document.objects[0].modifiers.map((modifier) => modifier.id)).toEqual([
      'mirror',
    ]);
    expect(result?.document.objects[1]).toBe(kept);
  });

  it('leaves locked objects and a locked layer in place', () => {
    const locked = { ...object('locked'), locked: true };
    const onLockedLayer = object('child');
    const document = doc([locked, onLockedLayer], true);

    expect(deleteObjects(document, [locked.id, onLockedLayer.id])).toBeNull();
    expect(deleteObjects(doc([object('path')]), [])).toBeNull();
  });
});

describe('deleteLayer', () => {
  it('removes the layer, including locked children, and booleans that used them', () => {
    const child = { ...object('child'), locked: true };
    const other = object('other', [
      {
        id: 'bool',
        type: 'boolean',
        operation: 'difference',
        operandId: child.id,
        enabled: true,
      },
    ]);
    const document: Document = {
      ...doc([child]),
      layers: [
        { id: 'layer', name: 'Layer', visible: true, locked: false, order: 0 },
        { id: 'front', name: 'Front', visible: true, locked: false, order: 1 },
      ],
      objects: [child, { ...other, layerId: 'front' }],
    };

    const result = deleteLayer(document, 'layer');

    expect(result?.removedIds).toEqual([child.id]);
    expect(result?.document.layers.map((layer) => layer.id)).toEqual(['front']);
    expect(result?.document.objects.map((item) => item.id)).toEqual([other.id]);
    expect(result?.document.objects[0]?.modifiers).toEqual([]);
    expect(result?.document.objects[0]).toEqual({ ...other, layerId: 'front', modifiers: [] });
  });

  it('leaves a locked or missing layer in place', () => {
    const document = doc([object('path')], true);
    expect(deleteLayer(document, 'layer')).toBeNull();
    expect(deleteLayer(doc([object('path')]), 'missing')).toBeNull();
  });
});

function object(id: string, modifiers: readonly Modifier[] = []): VectorObject {
  return {
    id,
    name: id,
    layerId: 'layer',
    visible: true,
    locked: false,
    source: { subpaths: [] },
    style: {
      ...svgStrokeDefaults,
      fill: '#fff',
      stroke: null,
      strokeWidth: 1,
      fillRule: 'nonzero',
    },
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
    modifiers,
  };
}

function doc(objects: readonly VectorObject[], layerLocked = false): Document {
  return {
    id: 'doc',
    name: 'Doc',
    viewBox: { x: 0, y: 0, width: 10, height: 10 },
    layers: [{ id: 'layer', name: 'Layer', visible: true, locked: layerLocked, order: 0 }],
    objects,
    swatches: [],
    gradients: [],
  };
}
