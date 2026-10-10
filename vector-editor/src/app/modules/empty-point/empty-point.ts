import { createId } from '@vector-editor/core/utils';
import { nextSeriesName } from '../document-edits';
import {
  Document,
  ObjectTransform,
  SourcePath,
  Style,
  svgStrokeDefaults,
  Vec2,
  VectorObject,
} from '../types';

const identityTransform: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
};

const emptyStyle: Style = {
  ...svgStrokeDefaults,
  fill: null,
  stroke: null,
  strokeWidth: 0,
  fillRule: 'nonzero',
};

const emptySource: SourcePath = { subpaths: [] };

export interface EmptyPointResult {
  readonly document: Document;
  readonly objectId: string;
}

export function isEmptyPoint(object: VectorObject): boolean {
  return object.kind === 'empty';
}

export function addEmptyPoint(
  document: Document,
  position: Vec2,
  layerId?: string,
): EmptyPointResult | null {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return null;
  }
  const layer = pointLayer(document, layerId);
  if (!layer || layer.locked || !layer.visible) {
    return null;
  }
  const objectId = createId();
  const object: VectorObject = {
    id: objectId,
    name: nextSeriesName(
      document.objects.map((item) => item.name),
      'Empty Point',
    ),
    layerId: layer.id,
    visible: true,
    locked: false,
    kind: 'empty',
    source: emptySource,
    style: emptyStyle,
    transform: { ...identityTransform, x: position.x, y: position.y },
    modifiers: [],
  };
  return {
    document: { ...document, objects: [...document.objects, object] },
    objectId,
  };
}

function pointLayer(document: Document, layerId: string | undefined) {
  if (layerId !== undefined) {
    return document.layers.find((layer) => layer.id === layerId);
  }
  return [...document.layers].sort((left, right) => left.order - right.order)[0];
}
