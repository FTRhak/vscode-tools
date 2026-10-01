import { Document, Modifier, VectorObject } from '@vector-editor/core';
import { duplicateObjects } from './duplicate-objects';

describe('duplicateObjects', () => {
  it('points a copied boolean at the copied operand', () => {
    const operand = object('operand');
    const host = object('host', [
      {
        id: 'bool',
        type: 'boolean',
        operation: 'difference',
        operandId: operand.id,
        enabled: true,
      },
    ]);
    const document = doc([host, operand]);

    const result = duplicateObjects(document, [host.id, operand.id]);
    const copies = result?.document.objects.slice(2) ?? [];
    const hostCopy = copies.find((item) => item.name === 'host copy');
    const operandCopy = copies.find((item) => item.name === 'operand copy');
    const modifier = hostCopy?.modifiers[0];

    expect(copies.map((item) => item.id)).toEqual(result?.newIds);
    expect(modifier?.type).toBe('boolean');
    if (modifier?.type === 'boolean') {
      expect(modifier.operandId).toBe(operandCopy?.id);
      expect(modifier.id).not.toBe('bool');
    }
  });

  it('keeps the original operand when it was not copied', () => {
    const host = object('host', [
      {
        id: 'bool',
        type: 'boolean',
        operation: 'union',
        operandId: 'other',
        enabled: true,
      },
    ]);

    const result = duplicateObjects(doc([host]), [host.id]);
    const modifier = result?.document.objects[1].modifiers[0];

    expect(modifier?.type).toBe('boolean');
    if (modifier?.type === 'boolean') {
      expect(modifier.operandId).toBe('other');
    }
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

function doc(objects: readonly VectorObject[]): Document {
  return {
    id: 'doc',
    name: 'Doc',
    viewBox: { x: 0, y: 0, width: 10, height: 10 },
    layers: [{ id: 'layer', name: 'Layer', visible: true, locked: false, order: 0 }],
    objects,
    swatches: [],
    gradients: [],
  };
}
