import { createId } from '@vector-editor/core/utils';
import { remintSource } from '../eval/remint';
import { nextSeriesName } from '../document-edits';
import { isImage } from '../object-image';
import { Document, svgStrokeDefaults, VectorObject } from '../types';

export function expandTrace(
  document: Document,
  objectId: string,
  modifierId?: string,
): { readonly document: Document; readonly newIds: readonly string[] } | null {
  const index = document.objects.findIndex((object) => object.id === objectId);
  const object = document.objects[index];
  if (!object || !isImage(object)) {
    return null;
  }
  const trace = object.modifiers.find(
    (modifier) => modifier.type === 'trace' && (modifierId === undefined || modifier.id === modifierId),
  );
  if (!trace || trace.type !== 'trace') {
    return null;
  }
  if (trace.regions.length === 0) {
    return { document, newIds: [] };
  }
  const names = document.objects.filter((item) => item.id !== object.id).map((item) => item.name);
  const created = trace.regions.map((region) => {
    const name = nextSeriesName(names, object.name);
    names.push(name);
    const path: VectorObject = {
      id: createId(),
      name,
      layerId: object.layerId,
      visible: object.visible,
      locked: object.locked,
      source: remintSource(region.source),
      style: {
        ...svgStrokeDefaults,
        fill: region.fill,
        stroke: null,
        strokeWidth: 0,
        fillRule: 'evenodd',
      },
      transform: object.transform,
      modifiers: [],
    };
    return path;
  });
  const objects = [...document.objects];
  objects.splice(index, 1, ...created);
  return {
    document: { ...document, objects },
    newIds: created.map((item) => item.id),
  };
}
