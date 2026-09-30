import { Document, Modifier, VectorObject } from '@vector-editor/core';
import { deleteObjects } from './delete-objects';

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

function object(id: string, modifiers: readonly Modifier[] = []): VectorObject {
  return {
    id,
    name: id,
    layerId: 'layer',
    visible: true,
    locked: false,
    source: { subpaths: [] },
    style: { fill: '#fff', stroke: null, strokeWidth: 1, fillRule: 'nonzero' },
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
  };
}
