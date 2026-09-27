import { createId } from './create-id';
import { layersFrontToBack } from './paint-order';
import { Document, Layer, Style, Swatch } from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/;

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
