import { Document, Layer, VectorObject } from './types';

export function layersBackToFront(document: Document): readonly Layer[] {
  return [...document.layers].sort((a, b) => a.order - b.order);
}

export function layersFrontToBack(document: Document): readonly Layer[] {
  return [...document.layers].sort((a, b) => b.order - a.order);
}

export function objectsOnLayer(document: Document, layerId: string): readonly VectorObject[] {
  return document.objects.filter((object) => object.layerId === layerId);
}

export function objectsInPaintOrder(document: Document): readonly VectorObject[] {
  const layers = layersBackToFront(document);
  const known = new Set(layers.map((layer) => layer.id));
  const ordered: VectorObject[] = [];

  for (const layer of layers) {
    for (const object of document.objects) {
      if (object.layerId === layer.id && object.visible) {
        ordered.push(object);
      }
    }
  }

  for (const object of document.objects) {
    if (!known.has(object.layerId) && object.visible) {
      ordered.push(object);
    }
  }

  return ordered;
}
