import { createId } from './create-id';
import { layersFrontToBack } from './paint-order';
import {
  Anchor,
  Document,
  Layer,
  ObjectTransform,
  Segment,
  Style,
  Swatch,
  VectorObject,
} from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/;

const identityTransform: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
};

const pathStyle: Style = {
  fill: '#c5d4f0',
  stroke: '#1a1a1a',
  strokeWidth: 4,
  fillRule: 'nonzero',
};

export interface StylePatch {
  readonly fill?: string | null;
  readonly stroke?: string | null;
  readonly strokeWidth?: number;
}

export function nextSeriesName(names: readonly string[], base: string): string {
  const taken = new Set(names);
  if (!taken.has(base)) {
    return base;
  }
  let index = 2;
  while (taken.has(`${base} ${index}`)) {
    index += 1;
  }
  return `${base} ${index}`;
}

export function setObjectStyle(
  document: Document,
  objectIds: readonly string[],
  patch: StylePatch,
): Document {
  const fill = normalizeColor(patch.fill);
  const stroke = normalizeColor(patch.stroke);
  const strokeWidth = normalizeWidth(patch.strokeWidth);
  if (fill === undefined && stroke === undefined && strokeWidth === undefined) {
    return document;
  }
  const wanted = new Set(objectIds);
  if (wanted.size === 0) {
    return document;
  }
  let changed = false;
  const objects = document.objects.map((object) => {
    if (!wanted.has(object.id)) {
      return object;
    }
    const style = nextStyle(object.style, fill, stroke, strokeWidth);
    if (style === object.style) {
      return object;
    }
    changed = true;
    return { ...object, style };
  });
  return changed ? { ...document, objects } : document;
}

export function addSwatch(document: Document, name: string, color: string): Document {
  const trimmed = name.trim();
  const hex = normalizeColor(color);
  if (!trimmed || hex === undefined || hex === null) {
    return document;
  }
  const swatch: Swatch = { id: createId(), name: trimmed, color: hex };
  return { ...document, swatches: [...document.swatches, swatch] };
}

export function applySwatch(
  document: Document,
  swatchId: string,
  target: 'fill' | 'stroke',
  objectIds: readonly string[],
): Document {
  const swatch = document.swatches.find((item) => item.id === swatchId);
  if (!swatch) {
    return document;
  }
  return setObjectStyle(
    document,
    objectIds,
    target === 'fill' ? { fill: swatch.color } : { stroke: swatch.color },
  );
}

export function addLayer(document: Document): Document {
  const maxOrder = document.layers.reduce((max, layer) => Math.max(max, layer.order), -1);
  const layer: Layer = {
    id: createId(),
    name: nextSeriesName(
      document.layers.map((item) => item.name),
      'Layer',
    ),
    visible: true,
    locked: false,
    order: maxOrder + 1,
  };
  return { ...document, layers: [...document.layers, layer] };
}

export function updateLayer(
  document: Document,
  id: string,
  patch: { readonly name?: string; readonly visible?: boolean; readonly locked?: boolean },
): Document {
  const name = patch.name?.trim();
  let changed = false;
  const layers = document.layers.map((layer) => {
    if (layer.id !== id) {
      return layer;
    }
    let next = layer;
    if (name && name !== layer.name) {
      next = { ...next, name };
    }
    if (patch.visible !== undefined && patch.visible !== layer.visible) {
      next = { ...next, visible: patch.visible };
    }
    if (patch.locked !== undefined && patch.locked !== layer.locked) {
      next = { ...next, locked: patch.locked };
    }
    if (next !== layer) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...document, layers } : document;
}

export function reorderLayer(document: Document, id: string, index: number): Document {
  if (!Number.isInteger(index)) {
    return document;
  }
  const front = layersFrontToBack(document);
  const current = front.findIndex((layer) => layer.id === id);
  if (current < 0) {
    return document;
  }
  const target = Math.min(front.length - 1, Math.max(0, index));
  if (target === current) {
    return document;
  }
  const next = front.slice();
  const [moved] = next.splice(current, 1);
  if (!moved) {
    return document;
  }
  next.splice(target, 0, moved);
  const count = next.length;
  const orders = new Map(next.map((layer, visualIndex) => [layer.id, count - 1 - visualIndex]));
  let changed = false;
  const layers = document.layers.map((layer) => {
    const order = orders.get(layer.id);
    if (order === undefined || layer.order === order) {
      return layer;
    }
    changed = true;
    return { ...layer, order };
  });
  return changed ? { ...document, layers } : document;
}

export function addPath(
  document: Document,
  layerId: string,
): { readonly document: Document; readonly objectId: string } | null {
  const layer = document.layers.find((item) => item.id === layerId);
  if (!layer || layer.locked || !layer.visible) {
    return null;
  }
  const bounds = pathBounds(document);
  if (!bounds) {
    return null;
  }
  const anchors = [
    corner(bounds.x, bounds.y),
    corner(bounds.x + bounds.width, bounds.y),
    corner(bounds.x + bounds.width, bounds.y + bounds.height),
    corner(bounds.x, bounds.y + bounds.height),
  ];
  const objectId = createId();
  const object: VectorObject = {
    id: objectId,
    name: nextSeriesName(
      document.objects.map((item) => item.name),
      'Path',
    ),
    layerId,
    visible: true,
    locked: false,
    source: {
      subpaths: [
        {
          closed: true,
          anchors,
          segments: [
            line(anchors[0], anchors[1]),
            line(anchors[1], anchors[2]),
            line(anchors[2], anchors[3]),
            line(anchors[3], anchors[0]),
          ],
        },
      ],
    },
    style: pathStyle,
    transform: identityTransform,
    modifiers: [],
  };
  return { document: { ...document, objects: [...document.objects, object] }, objectId };
}

function pathBounds(
  document: Document,
): { x: number; y: number; width: number; height: number } | null {
  const box = document.viewBox;
  const width = Math.min(200, box.width / 2);
  const height = Math.min(140, box.height / 2);
  if (!(width > 0) || !(height > 0)) {
    return null;
  }
  const shift = (document.objects.length % 6) * 24;
  return {
    x: box.x + (box.width - width) / 2 + shift,
    y: box.y + (box.height - height) / 2 + shift,
    width,
    height,
  };
}

function corner(x: number, y: number): Anchor {
  return {
    id: createId(),
    position: { x, y },
    handleIn: null,
    handleOut: null,
  };
}

function line(from: Anchor, to: Anchor): Segment {
  return {
    id: createId(),
    kind: 'line',
    fromId: from.id,
    toId: to.id,
  };
}

function nextStyle(
  style: Style,
  fill: string | null | undefined,
  stroke: string | null | undefined,
  strokeWidth: number | undefined,
): Style {
  const next: Style = {
    fill: fill !== undefined && fill !== style.fill ? fill : style.fill,
    stroke: stroke !== undefined && stroke !== style.stroke ? stroke : style.stroke,
    strokeWidth:
      strokeWidth !== undefined && strokeWidth !== style.strokeWidth
        ? strokeWidth
        : style.strokeWidth,
    fillRule: style.fillRule,
  };
  if (
    next.fill === style.fill &&
    next.stroke === style.stroke &&
    next.strokeWidth === style.strokeWidth
  ) {
    return style;
  }
  return next;
}

function normalizeColor(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const color = value.trim().toLowerCase();
  return HEX_COLOR.test(color) ? color : undefined;
}

function normalizeWidth(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}
