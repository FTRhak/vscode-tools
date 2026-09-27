import { createId } from '../model/create-id';
import {
  Anchor,
  Document,
  Layer,
  Modifier,
  ObjectTransform,
  Segment,
  SourcePath,
  Style,
  Subpath,
  Swatch,
  Vec2,
  VectorObject,
} from '../model/types';
import {
  identityTransform,
  Matrix,
  multiplyMatrix,
  parseSvgTransform,
  transformSource,
} from './matrix';
import { parsePathData } from './path-data-parse';
import { primitiveToSource } from './shapes';

const documentAttribute = 'data-vector-editor-document';
const layerAttribute = 'data-vector-editor-layer';
const objectAttribute = 'data-vector-editor';

const skippedTags = new Set([
  'text',
  'image',
  'use',
  'foreignObject',
  'linearGradient',
  'radialGradient',
  'filter',
  'clipPath',
  'mask',
  'pattern',
  'symbol',
  'script',
  'style',
]);

const ignoredTags = new Set(['title', 'desc', 'metadata']);
const shapeTags = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const transparentTags = new Set(['a', 'switch']);

const defaultStyle: Style = {
  fill: '#000000',
  stroke: null,
  strokeWidth: 1,
  fillRule: 'nonzero',
};

export type SvgImportResult =
  | { readonly ok: true; readonly document: Document; readonly skipped: number }
  | { readonly ok: false };

interface LayerDraft {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly order: number;
  readonly objects: VectorObject[];
}

interface WalkContext {
  readonly matrix: Matrix;
  readonly style: Style;
  readonly hidden: boolean;
  readonly layer: LayerDraft | null;
}

export function importSvg(markup: string): SvgImportResult {
  const svg = parseRoot(markup);
  if (!svg) {
    return { ok: false };
  }

  const used = new Set<string>();
  const meta = readDocumentMeta(svg, used);
  const layers: LayerDraft[] = [];
  let loose: LayerDraft | null = null;
  let skipped = 0;

  const claim = (id: string | null): string => {
    if (id && !used.has(id)) {
      used.add(id);
      return id;
    }
    const next = createId();
    used.add(next);
    return next;
  };

  const ensureLoose = (): LayerDraft => {
    if (loose) {
      return loose;
    }
    loose = {
      id: claim(null),
      name: 'Layer',
      visible: true,
      locked: false,
      order: layers.length,
      objects: [],
    };
    layers.push(loose);
    return loose;
  };

  const addGroupLayer = (group: Element, parent: WalkContext): void => {
    loose = null;
    const header = readLayerMeta(group, claim);
    const layer: LayerDraft = { ...header, order: layers.length, objects: [] };
    layers.push(layer);
    walk(
      group,
      {
        matrix: multiplyMatrix(parent.matrix, parseSvgTransform(group.getAttribute('transform'))),
        style: readStyle(group, parent.style),
        hidden: false,
        layer,
      },
      true,
    );
  };

  const walk = (container: Element, context: WalkContext, insideGroup: boolean): void => {
    for (const child of container.children) {
      const name = child.localName;
      if (ignoredTags.has(name)) {
        continue;
      }
      if (skippedTags.has(name)) {
        skipped += 1;
        continue;
      }
      if (name === 'defs') {
        skipped += countSkipped(child);
        continue;
      }
      if (name === 'g' || name === 'svg') {
        if (!insideGroup) {
          addGroupLayer(child, context);
        } else if (context.layer) {
          walk(child, nestedContext(child, context), true);
        }
        continue;
      }
      if (transparentTags.has(name)) {
        walk(child, context, insideGroup);
        continue;
      }
      if (!shapeTags.has(name)) {
        skipped += 1;
        continue;
      }
      const layer = context.layer ?? ensureLoose();
      const object = readObject(child, layer.id, context, claim);
      if (object) {
        layer.objects.push(object);
      }
    }
  };

  walk(
    svg,
    {
      matrix: parseSvgTransform(svg.getAttribute('transform')),
      style: readStyle(svg, defaultStyle),
      hidden: false,
      layer: null,
    },
    false,
  );

  if (layers.length === 0) {
    layers.push({
      id: claim(null),
      name: 'Layer',
      visible: true,
      locked: false,
      order: 0,
      objects: [],
    });
  }

  return {
    ok: true,
    skipped,
    document: {
      id: meta.id,
      name: meta.name,
      viewBox: readViewBox(svg),
      layers: layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        order: layer.order,
      })),
      objects: layers.flatMap((layer) => layer.objects),
      swatches: meta.swatches,
    },
  };
}

function parseRoot(markup: string): Element | null {
  if (markup.trim().length === 0) {
    return null;
  }
  let parsed: XMLDocument;
  try {
    parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  } catch {
    return null;
  }
  if (parsed.getElementsByTagName('parsererror').length > 0) {
    return null;
  }
  const root = parsed.documentElement;
  return root.localName === 'svg' ? root : null;
}

function countSkipped(element: Element): number {
  let count = 0;
  for (const child of element.children) {
    const name = child.localName;
    if (ignoredTags.has(name) || shapeTags.has(name)) {
      continue;
    }
    if (skippedTags.has(name)) {
      count += 1;
      continue;
    }
    if (name === 'defs' || name === 'g' || name === 'svg' || transparentTags.has(name)) {
      count += countSkipped(child);
      continue;
    }
    count += 1;
  }
  return count;
}

function nestedContext(element: Element, parent: WalkContext): WalkContext {
  return {
    matrix: multiplyMatrix(parent.matrix, parseSvgTransform(element.getAttribute('transform'))),
    style: readStyle(element, parent.style),
    hidden: parent.hidden || elementHidden(element),
    layer: parent.layer,
  };
}

function readObject(
  element: Element,
  layerId: string,
  context: WalkContext,
  claim: (id: string | null) => string,
): VectorObject | null {
  const payload = readObjectPayload(element.getAttribute(objectAttribute), claim);
  const source = payload ? claimSource(payload.source, claim) : geometrySource(element, context);
  if (!source || source.subpaths.every((subpath) => subpath.anchors.length === 0)) {
    return null;
  }
  const id = claim(element.getAttribute('id'));
  return {
    id,
    name: payload?.name || element.getAttribute('id') || 'Path',
    layerId,
    visible: !context.hidden && !elementHidden(element),
    locked: payload?.locked === true,
    source,
    style: readStyle(element, context.style),
    transform: payload?.transform ?? identityTransform,
    modifiers: payload?.modifiers ?? [],
  };
}

function geometrySource(element: Element, context: WalkContext): SourcePath | null {
  const local =
    element.localName === 'path'
      ? parsePathData(element.getAttribute('d') ?? '')
      : primitiveToSource(element);
  if (!local) {
    return null;
  }
  const matrix = multiplyMatrix(
    context.matrix,
    parseSvgTransform(element.getAttribute('transform')),
  );
  return transformSource(local, matrix);
}

function readDocumentMeta(
  svg: Element,
  used: Set<string>,
): { id: string; name: string; swatches: readonly Swatch[] } {
  const json = parseJson(svg.getAttribute(documentAttribute));
  const name = stringField(json, 'name') || textTitle(svg) || 'Untitled';
  const id = claimId(stringField(json, 'id'), used);
  return { id, name, swatches: readSwatches(isRecord(json) ? json['swatches'] : null, used) };
}

function readLayerMeta(
  group: Element,
  claim: (id: string | null) => string,
): Pick<Layer, 'id' | 'name' | 'visible' | 'locked'> {
  const json = parseJson(group.getAttribute(layerAttribute));
  const visible = booleanField(json, 'visible');
  return {
    id: claim(stringField(json, 'id')),
    name: stringField(json, 'name') || textTitle(group) || group.getAttribute('id') || 'Layer',
    visible: visible ?? !elementHidden(group),
    locked: booleanField(json, 'locked') === true,
  };
}

function readObjectPayload(
  value: string | null,
  claim: (id: string | null) => string,
): {
  source: SourcePath;
  transform: ObjectTransform;
  name: string;
  locked: boolean;
  modifiers: readonly Modifier[];
} | null {
  const json = parseJson(value);
  if (!isRecord(json)) {
    return null;
  }
  const source = readSource(json['source']);
  if (!source) {
    return null;
  }
  return {
    source,
    transform: readTransform(json['transform']),
    name: stringField(json, 'name') ?? '',
    locked: booleanField(json, 'locked') === true,
    modifiers: readModifiers(json['modifiers'], claim),
  };
}

function readModifiers(value: unknown, claim: (id: string | null) => string): Modifier[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const modifier = readModifier(item, claim);
    return modifier ? [modifier] : [];
  });
}

function readModifier(value: unknown, claim: (id: string | null) => string): Modifier | null {
  if (!isRecord(value)) {
    return null;
  }
  const enabled = booleanField(value, 'enabled') ?? true;
  if (value['type'] === 'array') {
    const count = value['count'];
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      return null;
    }
    return {
      id: claim(stringField(value, 'id')),
      type: 'array',
      count: Math.max(1, Math.floor(count)),
      offsetX: finiteField(value, 'offsetX', 0),
      offsetY: finiteField(value, 'offsetY', 0),
      enabled,
    };
  }
  if (value['type'] === 'mirror') {
    const axis = value['axis'];
    if (axis !== 'x' && axis !== 'y' && axis !== 'xy') {
      return null;
    }
    return { id: claim(stringField(value, 'id')), type: 'mirror', axis, enabled };
  }
  return null;
}

function readSource(value: unknown): SourcePath | null {
  if (!isRecord(value) || !Array.isArray(value['subpaths'])) {
    return null;
  }
  const subpaths: Subpath[] = [];
  for (const item of value['subpaths']) {
    const subpath = readSubpath(item);
    if (subpath) {
      subpaths.push(subpath);
    }
  }
  return { subpaths };
}

function readSubpath(value: unknown): Subpath | null {
  if (!isRecord(value) || !Array.isArray(value['anchors'])) {
    return null;
  }
  const anchors: Anchor[] = [];
  for (const item of value['anchors']) {
    const anchor = readAnchor(item);
    if (anchor) {
      anchors.push(anchor);
    }
  }
  const segments: Segment[] = [];
  if (Array.isArray(value['segments'])) {
    for (const item of value['segments']) {
      const segment = readSegment(item, anchors);
      if (segment) {
        segments.push(segment);
      }
    }
  }
  return { closed: value['closed'] === true, anchors, segments };
}

function readAnchor(value: unknown): Anchor | null {
  if (!isRecord(value)) {
    return null;
  }
  const position = readVec(value['position']);
  if (!position) {
    return null;
  }
  return {
    id: stringField(value, 'id') || createId(),
    position,
    handleIn: readVec(value['handleIn']),
    handleOut: readVec(value['handleOut']),
  };
}

function readSegment(value: unknown, anchors: readonly Anchor[]): Segment | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = value['kind'] === 'cubic' || value['kind'] === 'line' ? value['kind'] : null;
  if (!kind) {
    return null;
  }
  const fromId = anchorId(value['fromId'] ?? value['from'], anchors);
  const toId = anchorId(value['toId'] ?? value['to'], anchors);
  if (!fromId || !toId) {
    return null;
  }
  return { id: stringField(value, 'id') || createId(), kind, fromId, toId };
}

function anchorId(value: unknown, anchors: readonly Anchor[]): string | null {
  if (typeof value === 'string') {
    return anchors.some((anchor) => anchor.id === value) ? value : null;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return anchors[value]?.id ?? null;
  }
  return null;
}

function claimSource(source: SourcePath, claim: (id: string | null) => string): SourcePath {
  return {
    subpaths: source.subpaths.map((subpath) => {
      const ids = new Map(subpath.anchors.map((anchor) => [anchor.id, claim(anchor.id)]));
      return {
        closed: subpath.closed,
        anchors: subpath.anchors.map((anchor) => ({
          ...anchor,
          id: ids.get(anchor.id) ?? claim(null),
        })),
        segments: subpath.segments.flatMap((segment) => {
          const fromId = ids.get(segment.fromId);
          const toId = ids.get(segment.toId);
          if (!fromId || !toId) {
            return [];
          }
          return [{ ...segment, id: claim(segment.id), fromId, toId }];
        }),
      };
    }),
  };
}

function readTransform(value: unknown): ObjectTransform {
  if (!isRecord(value)) {
    return identityTransform;
  }
  return {
    x: finiteField(value, 'x', 0),
    y: finiteField(value, 'y', 0),
    rotation: finiteField(value, 'rotation', 0),
    scaleX: finiteField(value, 'scaleX', 1),
    scaleY: finiteField(value, 'scaleY', 1),
  };
}

function readSwatches(value: unknown, used: Set<string>): Swatch[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const name = stringField(item, 'name');
    const color = stringField(item, 'color');
    if (!name || !color) {
      return [];
    }
    return [{ id: claimId(stringField(item, 'id'), used), name, color }];
  });
}

function readStyle(element: Element, inherited: Style): Style {
  const inline = parseStyleAttribute(element.getAttribute('style'));
  const fill = paintValue(inline['fill'] ?? attributeValue(element, 'fill'), inherited.fill);
  const stroke = paintValue(
    inline['stroke'] ?? attributeValue(element, 'stroke'),
    inherited.stroke,
  );
  const widthSource = inline['stroke-width'] ?? attributeValue(element, 'stroke-width');
  const ruleSource = inline['fill-rule'] ?? attributeValue(element, 'fill-rule');
  return {
    fill,
    stroke,
    strokeWidth:
      widthSource === undefined
        ? inherited.strokeWidth
        : strokeWidth(widthSource, inherited.strokeWidth),
    fillRule:
      ruleSource === 'evenodd'
        ? 'evenodd'
        : ruleSource === 'nonzero'
          ? 'nonzero'
          : inherited.fillRule,
  };
}

function paintValue(value: string | undefined, fallback: string | null): string | null {
  if (value === undefined || value === 'inherit') {
    return fallback;
  }
  const trimmed = value.trim();
  if (
    trimmed === '' ||
    trimmed === 'none' ||
    trimmed === 'transparent' ||
    /^url\(/i.test(trimmed)
  ) {
    return null;
  }
  if (trimmed.toLowerCase() === 'currentcolor') {
    return '#000000';
  }
  return trimmed;
}

function strokeWidth(value: string, fallback: number): number {
  if (value.trim().endsWith('%')) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function attributeValue(element: Element, name: string): string | undefined {
  return element.hasAttribute(name) ? (element.getAttribute(name) ?? undefined) : undefined;
}

function parseStyleAttribute(style: string | null): Readonly<Record<string, string>> {
  if (!style) {
    return {};
  }
  const declarations: Record<string, string> = {};
  for (const part of style.split(';')) {
    const split = part.indexOf(':');
    if (split === -1) {
      continue;
    }
    const key = part.slice(0, split).trim().toLowerCase();
    const value = part.slice(split + 1).trim();
    if (key) {
      declarations[key] = value;
    }
  }
  return declarations;
}

function elementHidden(element: Element): boolean {
  const inline = parseStyleAttribute(element.getAttribute('style'));
  const display = inline['display'] ?? element.getAttribute('display');
  const visibility = inline['visibility'] ?? element.getAttribute('visibility');
  return display === 'none' || visibility === 'hidden' || visibility === 'collapse';
}

function readViewBox(svg: Element): Document['viewBox'] {
  const raw = svg.getAttribute('viewBox');
  if (raw) {
    const values = raw
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      values.length === 4 &&
      values.every((value) => Number.isFinite(value)) &&
      values[2] > 0 &&
      values[3] > 0
    ) {
      return { x: values[0], y: values[1], width: values[2], height: values[3] };
    }
  }
  const width = positiveLength(svg.getAttribute('width'));
  const height = positiveLength(svg.getAttribute('height'));
  if (width !== null && height !== null) {
    return { x: 0, y: 0, width, height };
  }
  return { x: 0, y: 0, width: 1200, height: 800 };
}

function positiveLength(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function textTitle(element: Element): string | null {
  for (const child of element.children) {
    if (child.localName === 'title') {
      const text = child.textContent?.trim();
      return text ? text : null;
    }
  }
  return null;
}

function claimId(id: string | null, used: Set<string>): string {
  if (id && !used.has(id)) {
    used.add(id);
    return id;
  }
  const next = createId();
  used.add(next);
  return next;
}

function parseJson(value: string | null): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const field = value[key];
  return typeof field === 'string' && field.length > 0 ? field : null;
}

function booleanField(value: unknown, key: string): boolean | null {
  if (!isRecord(value)) {
    return null;
  }
  const field = value[key];
  return typeof field === 'boolean' ? field : null;
}

function finiteField(value: Record<string, unknown>, key: string, fallback: number): number {
  const field = value[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : fallback;
}

function readVec(value: unknown): Vec2 | null {
  if (!isRecord(value)) {
    return null;
  }
  const x = value['x'];
  const y = value['y'];
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }
  return { x, y };
}
