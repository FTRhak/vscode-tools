import { createId } from '@vector-editor/core/utils';
import { layersFrontToBack } from '../paint-order';
import {
  Anchor,
  Document,
  Gradient,
  Layer,
  ObjectTransform,
  Segment,
  Style,
  svgStrokeDefaults,
  Swatch,
  VectorObject,
} from '../types';

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
  ...svgStrokeDefaults,
  fill: '#c5d4f0',
  stroke: '#1a1a1a',
  strokeWidth: 4,
  fillRule: 'nonzero',
};

export interface StylePatch {
  readonly fill?: string | null;
  readonly stroke?: string | null;
  readonly strokeWidth?: number;
  readonly strokeLinecap?: Style['strokeLinecap'];
  readonly strokeLinejoin?: Style['strokeLinejoin'];
  readonly strokeMiterlimit?: number;
  readonly strokeOpacity?: number;
  readonly strokeDashoffset?: number;
  readonly strokeDasharray?: readonly number[] | null;
  readonly strokeAlign?: Style['strokeAlign'];
}

export function createGradient(
  document: Document,
  definition: Omit<Gradient, 'id'>,
  target: 'fill' | 'stroke',
  objectIds: readonly string[],
): Document {
  const name = definition.name.trim();
  const stops = definition.stops.map((stop) => ({
    ...stop,
    color: normalizeColor(stop.color),
  }));
  const ids = new Set(objectIds);
  if (
    !name ||
    stops.length < 2 ||
    stops.some(
      (stop) =>
        typeof stop.color !== 'string' ||
        !Number.isFinite(stop.offset) ||
        stop.offset < 0 ||
        stop.offset > 1 ||
        !Number.isFinite(stop.opacity) ||
        stop.opacity < 0 ||
        stop.opacity > 1,
    ) ||
    !document.objects.some((object) => ids.has(object.id)) ||
    !Number.isFinite(definition.angle) ||
    !Number.isFinite(definition.proportions) ||
    definition.proportions <= 0
  ) {
    return document;
  }
  const gradient: Gradient = {
    id: createId(),
    ...definition,
    name,
    stops: stops.map((stop) => ({ ...stop, color: stop.color as string })),
  };
  const withGradient = { ...document, gradients: [...document.gradients, gradient] };
  return setObjectStyle(withGradient, objectIds, {
    [target]: `url(#${gradient.id})`,
  });
}

export function updateGradient(
  document: Document,
  id: string,
  patch: Partial<Omit<Gradient, 'id'>>,
): Document {
  const index = document.gradients.findIndex((gradient) => gradient.id === id);
  if (index < 0) {
    return document;
  }

  const current = document.gradients[index];
  const nextDefinition: Omit<Gradient, 'id'> = {
    name: patch.name ?? current.name,
    type: patch.type ?? current.type,
    angle: patch.angle ?? current.angle,
    proportions: patch.proportions ?? current.proportions,
    stops: patch.stops ?? current.stops,
  };

  const name = nextDefinition.name.trim();
  const stops = nextDefinition.stops.map((stop) => ({
    ...stop,
    color: normalizeColor(stop.color),
  }));

  if (
    !name ||
    stops.length < 2 ||
    stops.some(
      (stop) =>
        typeof stop.color !== 'string' ||
        !Number.isFinite(stop.offset) ||
        stop.offset < 0 ||
        stop.offset > 1 ||
        !Number.isFinite(stop.opacity) ||
        stop.opacity < 0 ||
        stop.opacity > 1,
    ) ||
    !Number.isFinite(nextDefinition.angle) ||
    !Number.isFinite(nextDefinition.proportions) ||
    nextDefinition.proportions <= 0
  ) {
    return document;
  }

  const updated: Gradient = {
    ...current,
    ...nextDefinition,
    name,
    stops: stops.map((stop) => ({
      ...stop,
      color: stop.color as string,
    })),
  };

  const gradients = document.gradients.map((gradient) => (gradient.id === id ? updated : gradient));
  return { ...document, gradients };
}

export function deleteGradient(document: Document, id: string): Document {
  if (!document.gradients.some((gradient) => gradient.id === id)) {
    return document;
  }
  const reference = `url(#${id})`;
  const objects = document.objects.map((object) => {
    const fill = object.style.fill === reference ? null : object.style.fill;
    const stroke = object.style.stroke === reference ? null : object.style.stroke;
    return fill === object.style.fill && stroke === object.style.stroke
      ? object
      : { ...object, style: { ...object.style, fill, stroke } };
  });
  return {
    ...document,
    gradients: document.gradients.filter((gradient) => gradient.id !== id),
    objects,
  };
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
  const normalized = normalizeStylePatch(patch);
  if (
    normalized.fill === undefined &&
    normalized.stroke === undefined &&
    normalized.strokeWidth === undefined &&
    normalized.strokeLinecap === undefined &&
    normalized.strokeLinejoin === undefined &&
    normalized.strokeMiterlimit === undefined &&
    normalized.strokeOpacity === undefined &&
    normalized.strokeDashoffset === undefined &&
    normalized.strokeDasharray === undefined &&
    normalized.strokeAlign === undefined
  ) {
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
    if (object.kind === 'image') {
      return object;
    }
    const style = nextStyle(object.style, normalized);
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
    kind: 'path',
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

function nextStyle(style: Style, patch: ReturnType<typeof normalizeStylePatch>): Style {
  const strokeDasharray =
    patch.strokeDasharray !== undefined &&
    !sameDasharray(patch.strokeDasharray, style.strokeDasharray)
      ? copyDasharray(patch.strokeDasharray)
      : style.strokeDasharray;
  const next: Style = {
    fill: patch.fill !== undefined && patch.fill !== style.fill ? patch.fill : style.fill,
    stroke:
      patch.stroke !== undefined && patch.stroke !== style.stroke ? patch.stroke : style.stroke,
    strokeWidth:
      patch.strokeWidth !== undefined && patch.strokeWidth !== style.strokeWidth
        ? patch.strokeWidth
        : style.strokeWidth,
    strokeLinecap:
      patch.strokeLinecap !== undefined && patch.strokeLinecap !== style.strokeLinecap
        ? patch.strokeLinecap
        : style.strokeLinecap,
    strokeLinejoin:
      patch.strokeLinejoin !== undefined && patch.strokeLinejoin !== style.strokeLinejoin
        ? patch.strokeLinejoin
        : style.strokeLinejoin,
    strokeMiterlimit:
      patch.strokeMiterlimit !== undefined && patch.strokeMiterlimit !== style.strokeMiterlimit
        ? patch.strokeMiterlimit
        : style.strokeMiterlimit,
    strokeOpacity:
      patch.strokeOpacity !== undefined && patch.strokeOpacity !== style.strokeOpacity
        ? patch.strokeOpacity
        : style.strokeOpacity,
    strokeDashoffset:
      patch.strokeDashoffset !== undefined && patch.strokeDashoffset !== style.strokeDashoffset
        ? patch.strokeDashoffset
        : style.strokeDashoffset,
    strokeDasharray,
    strokeAlign:
      patch.strokeAlign !== undefined && patch.strokeAlign !== style.strokeAlign
        ? patch.strokeAlign
        : style.strokeAlign,
    fillRule: style.fillRule,
  };
  if (
    next.fill === style.fill &&
    next.stroke === style.stroke &&
    next.strokeWidth === style.strokeWidth &&
    next.strokeLinecap === style.strokeLinecap &&
    next.strokeLinejoin === style.strokeLinejoin &&
    next.strokeMiterlimit === style.strokeMiterlimit &&
    next.strokeOpacity === style.strokeOpacity &&
    next.strokeDashoffset === style.strokeDashoffset &&
    sameDasharray(next.strokeDasharray, style.strokeDasharray) &&
    next.strokeAlign === style.strokeAlign
  ) {
    return style;
  }
  return next;
}

function normalizeStylePatch(patch: StylePatch): {
  readonly fill: string | null | undefined;
  readonly stroke: string | null | undefined;
  readonly strokeWidth: number | undefined;
  readonly strokeLinecap: Style['strokeLinecap'] | undefined;
  readonly strokeLinejoin: Style['strokeLinejoin'] | undefined;
  readonly strokeMiterlimit: number | undefined;
  readonly strokeOpacity: number | undefined;
  readonly strokeDashoffset: number | undefined;
  readonly strokeDasharray: readonly number[] | null | undefined;
  readonly strokeAlign: Style['strokeAlign'] | undefined;
} {
  return {
    fill: normalizeColor(patch.fill),
    stroke: normalizeColor(patch.stroke),
    strokeWidth: normalizeWidth(patch.strokeWidth),
    strokeLinecap: normalizeLinecap(patch.strokeLinecap),
    strokeLinejoin: normalizeLinejoin(patch.strokeLinejoin),
    strokeMiterlimit: normalizeMiterlimit(patch.strokeMiterlimit),
    strokeOpacity: normalizeOpacity(patch.strokeOpacity),
    strokeDashoffset: normalizeDashoffset(patch.strokeDashoffset),
    strokeDasharray: normalizeDasharray(patch.strokeDasharray),
    strokeAlign: normalizeStrokeAlign(patch.strokeAlign),
  };
}

function normalizeColor(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const color = value.trim().toLowerCase();
  return HEX_COLOR.test(color) || /^url\(#[a-z0-9_-]+\)$/.test(color) ? color : undefined;
}

function normalizeWidth(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

function normalizeLinecap(
  value: Style['strokeLinecap'] | undefined,
): Style['strokeLinecap'] | undefined {
  return value === 'butt' || value === 'round' || value === 'square' ? value : undefined;
}

function normalizeLinejoin(
  value: Style['strokeLinejoin'] | undefined,
): Style['strokeLinejoin'] | undefined {
  return value === 'miter' || value === 'round' || value === 'bevel' ? value : undefined;
}

function normalizeStrokeAlign(
  value: Style['strokeAlign'] | undefined,
): Style['strokeAlign'] | undefined {
  return value === 'default' || value === 'inside' || value === 'outside' ? value : undefined;
}

function normalizeMiterlimit(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return undefined;
  }
  return value;
}

function normalizeOpacity(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) {
    return undefined;
  }
  return value;
}

function normalizeDashoffset(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function normalizeDasharray(
  value: readonly number[] | null | undefined,
): readonly number[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.length === 0) {
    return null;
  }
  if (value.some((length) => !Number.isFinite(length) || length < 0)) {
    return undefined;
  }
  return value;
}

function copyDasharray(value: readonly number[] | null): readonly number[] | null {
  return value === null ? null : [...value];
}

function sameDasharray(left: readonly number[] | null, right: readonly number[] | null): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null || left.length !== right.length) {
    return false;
  }
  return left.every((length, index) => length === right[index]);
}
