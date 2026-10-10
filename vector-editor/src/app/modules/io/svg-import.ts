import { createId } from '@vector-editor/core/utils';
import { imageContent, isImageDataUrl, isImageMime } from '@vector-editor/modules/object-image';
import { clampTraceSettings } from '@vector-editor/modules/image-trace';
import {
  Anchor,
  Document,
  ImageAspect,
  ImageMime,
  ImagePlacement,
  Layer,
  Modifier,
  ObjectTransform,
  Segment,
  SourcePath,
  Style,
  Subpath,
  svgStrokeDefaults,
  Swatch,
  TraceRegion,
  Vec2,
  VectorObject,
} from '@vector-editor/modules/types';
import { identityTransform, Matrix, multiplyMatrix, parseSvgTransform, placementOf, transformSource } from './matrix';
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
  ...svgStrokeDefaults,
  fill: '#000000',
  stroke: null,
  strokeWidth: 1,
  fillRule: 'nonzero',
};

export type SvgImportResult = { readonly ok: true; readonly document: Document; readonly skipped: number } | { readonly ok: false };

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
  const gradients = readGradients(svg, used);
  const layers: LayerDraft[] = [];
  const operandLinks: OperandLink[] = [];
  const centerPointLinks: CenterPointLink[] = [];
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
      if (name === 'image') {
        const layer = context.layer ?? ensureLoose();
        const object = readImage(child, layer.id, context, claim, operandLinks, centerPointLinks);
        if (object) {
          layer.objects.push(object);
        } else {
          skipped += 1;
        }
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
      if (name === 'g' && imagePayload(child)) {
        const layer = context.layer ?? ensureLoose();
        const traced = readImage(child, layer.id, context, claim, operandLinks, centerPointLinks);
        if (traced) {
          layer.objects.push(traced);
        } else {
          skipped += 1;
        }
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
      const object = readObject(child, layer.id, context, claim, operandLinks, centerPointLinks);
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
      objects: resolveModifierReferences(
        layers.flatMap((layer) => layer.objects),
        operandLinks,
        centerPointLinks,
      ),
      swatches: meta.swatches,
      gradients,
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
    if (name === 'linearGradient' || name === 'radialGradient') {
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

interface OperandLink {
  readonly modifierId: string;
  readonly operandIndex: number;
}

interface CenterPointLink {
  readonly modifierId: string;
  readonly centerPointIndex: number;
}

function readObject(
  element: Element,
  layerId: string,
  context: WalkContext,
  claim: (id: string | null) => string,
  operandLinks: OperandLink[],
  centerPointLinks: CenterPointLink[],
): VectorObject | null {
  const payload = readObjectPayload(element.getAttribute(objectAttribute), claim, operandLinks, centerPointLinks);
  if (payload?.kind === 'empty') {
    return {
      id: claim(element.getAttribute('id')),
      name: payload.name || 'Empty Point',
      layerId,
      visible: !context.hidden && !elementHidden(element),
      locked: payload.locked === true,
      kind: 'empty',
      source: { subpaths: [] },
      style: {
        ...svgStrokeDefaults,
        fill: null,
        stroke: null,
        strokeWidth: 0,
        fillRule: 'nonzero',
        strokeAlign: payload.strokeAlign,
      },
      transform: payload.transform,
      modifiers: [],
    };
  }
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
    style: styleFromPayload(readStyle(element, context.style), payload),
    transform: payload?.transform ?? identityTransform,
    modifiers: payload?.modifiers ?? [],
  };
}

function imagePayload(element: Element): boolean {
  const json = parseJson(element.getAttribute(objectAttribute));
  return isRecord(json) && json['kind'] === 'image';
}

function readImage(
  element: Element,
  layerId: string,
  context: WalkContext,
  claim: (id: string | null) => string,
  operandLinks: OperandLink[],
  centerPointLinks: CenterPointLink[],
): VectorObject | null {
  const href = imageHref(element);
  const payload = readImagePayload(element.getAttribute(objectAttribute));
  const foreign = payload ? null : foreignImage(element, href, context);
  const resolved = payload ?? foreign;
  if (!resolved) {
    return null;
  }
  const dataUrl = resolved.dataUrl || dataUrlFromHref(href, resolved.mime);
  const content = imageContent({
    name: resolved.name || 'Image',
    placement: resolved.placement,
    fileName: resolved.fileName,
    mime: resolved.mime,
    dataUrl,
    pixelWidth: resolved.pixelWidth,
    pixelHeight: resolved.pixelHeight,
    x: 0,
    y: 0,
    width: resolved.width,
    height: resolved.height,
    preserveAspectRatio: resolved.preserveAspectRatio,
  });
  if (!content) {
    return null;
  }
  const raw = parseJson(element.getAttribute(objectAttribute));
  return {
    id: claim(element.getAttribute('id')),
    name: resolved.name || 'Image',
    layerId,
    visible: !context.hidden && !elementHidden(element),
    locked: resolved.locked,
    kind: 'image',
    source: { subpaths: [] },
    image: content,
    style: {
      ...svgStrokeDefaults,
      fill: null,
      stroke: null,
      strokeWidth: 0,
      fillRule: 'nonzero',
    },
    transform: resolved.transform,
    modifiers: readModifiers(isRecord(raw) ? raw['modifiers'] : undefined, claim, operandLinks, centerPointLinks),
  };
}

function imageHref(element: Element): string | null {
  return (
    element.getAttribute('href') || element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || element.getAttribute('xlink:href')
  );
}

function dataUrlFromHref(href: string | null, mime: ImageMime): string {
  if (!href || !isImageDataUrl(href, mime)) {
    return '';
  }
  return href;
}

interface ImageRead {
  readonly name: string;
  readonly placement: ImagePlacement;
  readonly fileName: string;
  readonly mime: ImageMime;
  readonly dataUrl: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly width: number;
  readonly height: number;
  readonly preserveAspectRatio: ImageAspect;
  readonly transform: ObjectTransform;
  readonly locked: boolean;
}

function readImagePayload(value: string | null): ImageRead | null {
  const json = parseJson(value);
  if (!isRecord(json) || json['kind'] !== 'image') {
    return null;
  }
  const mime = stringField(json, 'mime');
  const placement = json['placement'] === 'link' ? 'link' : json['placement'] === 'embed' ? 'embed' : null;
  const aspect = json['preserveAspectRatio'] === 'none' ? 'none' : 'xMidYMid meet';
  const width = finiteField(json, 'width', Number.NaN);
  const height = finiteField(json, 'height', Number.NaN);
  const pixelWidth = finiteField(json, 'pixelWidth', width);
  const pixelHeight = finiteField(json, 'pixelHeight', height);
  const fileName = stringField(json, 'fileName') ?? 'image.png';
  if (!mime || !isImageMime(mime) || !placement || width <= 0 || height <= 0) {
    return null;
  }
  return {
    name: stringField(json, 'name') ?? 'Image',
    placement,
    fileName,
    mime,
    dataUrl: stringField(json, 'dataUrl') ?? '',
    pixelWidth,
    pixelHeight,
    width,
    height,
    preserveAspectRatio: aspect,
    transform: readTransform(json['transform']),
    locked: booleanField(json, 'locked') === true,
  };
}

function foreignImage(element: Element, href: string | null, context: WalkContext): ImageRead | null {
  const box = imageBox(element);
  if (!box || !href) {
    return null;
  }
  const matrix = multiplyMatrix(context.matrix, parseSvgTransform(element.getAttribute('transform')));
  const transform = placementOf(matrix, { x: box.x, y: box.y });
  if (!transform) {
    return null;
  }
  const aspect = element.getAttribute('preserveAspectRatio')?.trim().startsWith('none') ? 'none' : 'xMidYMid meet';
  const embedded = readEmbeddedHref(href);
  if (embedded) {
    return {
      name: 'Image',
      placement: 'embed',
      fileName: `image.${embedded.mime === 'image/jpeg' ? 'jpg' : embedded.mime.slice('image/'.length)}`,
      mime: embedded.mime,
      dataUrl: embedded.dataUrl,
      pixelWidth: box.width,
      pixelHeight: box.height,
      width: box.width,
      height: box.height,
      preserveAspectRatio: aspect,
      transform,
      locked: false,
    };
  }
  const fileName = safeLinkName(href);
  if (!fileName) {
    return null;
  }
  const mime = mimeFromName(fileName);
  if (!mime) {
    return null;
  }
  return {
    name: fileName.replace(/\.[^.]+$/, '') || 'Image',
    placement: 'link',
    fileName,
    mime,
    dataUrl: '',
    pixelWidth: box.width,
    pixelHeight: box.height,
    width: box.width,
    height: box.height,
    preserveAspectRatio: aspect,
    transform,
    locked: false,
  };
}

function imageBox(element: Element): { x: number; y: number; width: number; height: number } | null {
  const x = readUserUnit(element.getAttribute('x')) ?? 0;
  const y = readUserUnit(element.getAttribute('y')) ?? 0;
  const width = readUserUnit(element.getAttribute('width'));
  const height = readUserUnit(element.getAttribute('height'));
  if (width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function readUserUnit(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.endsWith('%')) {
    return null;
  }
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function readEmbeddedHref(href: string): { readonly mime: ImageMime; readonly dataUrl: string } | null {
  const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,/i.exec(href);
  if (!match) {
    return null;
  }
  const mime = match[1].toLowerCase();
  if (!isImageMime(mime)) {
    return null;
  }
  const body = href.slice(match[0].length).replace(/\s/g, '');
  if (!isImageDataUrl(`data:${mime};base64,${body}`, mime)) {
    return null;
  }
  return { mime, dataUrl: `data:${mime};base64,${body}` };
}

function safeLinkName(href: string): string | null {
  if (
    href.includes(':') ||
    href.includes('\\') ||
    href.includes('?') ||
    href.includes('#') ||
    href.startsWith('/') ||
    href.includes('..')
  ) {
    return null;
  }
  const name = href.replace(/^\.\//, '');
  if (!name || name.includes('/')) {
    return null;
  }
  return name;
}

function mimeFromName(fileName: string): ImageMime | null {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

function geometrySource(element: Element, context: WalkContext): SourcePath | null {
  const local = element.localName === 'path' ? parsePathData(element.getAttribute('d') ?? '') : primitiveToSource(element);
  if (!local) {
    return null;
  }
  const matrix = multiplyMatrix(context.matrix, parseSvgTransform(element.getAttribute('transform')));
  return transformSource(local, matrix);
}

function readDocumentMeta(svg: Element, used: Set<string>): { id: string; name: string; swatches: readonly Swatch[] } {
  const json = parseJson(svg.getAttribute(documentAttribute));
  const name = stringField(json, 'name') || textTitle(svg) || 'Untitled';
  const id = claimId(stringField(json, 'id'), used);
  return { id, name, swatches: readSwatches(isRecord(json) ? json['swatches'] : null, used) };
}

function readLayerMeta(group: Element, claim: (id: string | null) => string): Pick<Layer, 'id' | 'name' | 'visible' | 'locked'> {
  const json = parseJson(group.getAttribute(layerAttribute));
  const visible = booleanField(json, 'visible');
  return {
    id: claim(stringField(json, 'id')),
    name: stringField(json, 'name') || textTitle(group) || group.getAttribute('id') || 'Layer',
    visible: visible ?? !elementHidden(group),
    locked: booleanField(json, 'locked') === true,
  };
}

function resolveModifierReferences(
  objects: VectorObject[],
  links: readonly OperandLink[],
  centerPointLinks: readonly CenterPointLink[],
): VectorObject[] {
  if (links.length === 0 && centerPointLinks.length === 0) {
    return objects;
  }
  const byModifier = new Map(links.map((link) => [link.modifierId, link.operandIndex]));
  const centerPointByModifier = new Map(centerPointLinks.map((link) => [link.modifierId, link.centerPointIndex]));
  return objects.map((object) => ({
    ...object,
    modifiers: object.modifiers.flatMap((modifier) => {
      if (modifier.type === 'boolean' && byModifier.has(modifier.id)) {
        const operand = objects[byModifier.get(modifier.id) ?? -1];
        return operand ? [{ ...modifier, operandId: operand.id }] : [];
      }
      if (modifier.type === 'mirror' && centerPointByModifier.has(modifier.id)) {
        const centerPoint = objects[centerPointByModifier.get(modifier.id) ?? -1];
        return centerPoint?.kind === 'empty' ? [{ ...modifier, centerPointId: centerPoint.id }] : [modifier];
      }
      return [modifier];
    }),
  }));
}

function readObjectPayload(
  value: string | null,
  claim: (id: string | null) => string,
  operandLinks: OperandLink[],
  centerPointLinks: CenterPointLink[],
): {
  source: SourcePath;
  transform: ObjectTransform;
  name: string;
  locked: boolean;
  kind: 'path' | 'empty';
  modifiers: readonly Modifier[];
  strokeAlign: Style['strokeAlign'];
  strokeWidth: number | undefined;
  stroke: string | null | undefined;
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
    kind: json['kind'] === 'empty' ? 'empty' : 'path',
    modifiers: readModifiers(json['modifiers'], claim, operandLinks, centerPointLinks),
    strokeAlign: readStrokeAlign(json['strokeAlign']),
    strokeWidth: readPayloadWidth(json['strokeWidth']),
    stroke: readPayloadStroke(json['stroke']),
  };
}

function styleFromPayload(
  painted: Style,
  payload: {
    strokeAlign: Style['strokeAlign'];
    strokeWidth: number | undefined;
    stroke: string | null | undefined;
  } | null,
): Style {
  if (!payload) {
    return { ...painted, strokeAlign: 'default' };
  }
  return {
    ...painted,
    strokeAlign: payload.strokeAlign,
    stroke: payload.stroke !== undefined ? payload.stroke : painted.stroke,
    strokeWidth: payload.strokeWidth !== undefined ? payload.strokeWidth : painted.strokeWidth,
  };
}

function readModifiers(
  value: unknown,
  claim: (id: string | null) => string,
  operandLinks: OperandLink[],
  centerPointLinks: CenterPointLink[],
): Modifier[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const modifier = readModifier(item, claim, operandLinks, centerPointLinks);
    return modifier ? [modifier] : [];
  });
}

function readModifier(
  value: unknown,
  claim: (id: string | null) => string,
  operandLinks: OperandLink[],
  centerPointLinks: CenterPointLink[],
): Modifier | null {
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
    if (axis !== 'x' && axis !== 'y' && axis !== 'xy' && axis !== 'none') {
      return null;
    }
    const id = claim(stringField(value, 'id'));
    const centerPointIndex = value['centerPointIndex'];
    if (typeof centerPointIndex === 'number' && Number.isInteger(centerPointIndex)) {
      centerPointLinks.push({ modifierId: id, centerPointIndex });
    }
    const centerPointId = stringField(value, 'centerPointId');
    return {
      id,
      type: 'mirror',
      axis,
      ...(centerPointId ? { centerPointId } : {}),
      enabled,
    };
  }
  if (value['type'] === 'bevel') {
    const distance = value['distance'];
    const join = value['join'];
    if (typeof distance !== 'number' || !Number.isFinite(distance)) {
      return null;
    }
    if (join !== 'bevel' && join !== 'miter' && join !== 'round') {
      return null;
    }
    return {
      id: claim(stringField(value, 'id')),
      type: 'bevel',
      distance,
      join,
      miterLimit: finiteField(value, 'miterLimit', 4),
      enabled,
    };
  }
  if (value['type'] === 'round') {
    const anchorCount = value['anchorCount'];
    const roundness = value['roundness'];
    if (typeof anchorCount !== 'number' || !Number.isFinite(anchorCount) || typeof roundness !== 'number' || !Number.isFinite(roundness)) {
      return null;
    }
    const mode = value['mode'];
    return {
      id: claim(stringField(value, 'id')),
      type: 'round',
      mode: mode === 'smooth' || mode === 'circle' ? mode : 'direct',
      anchorCount: Math.min(1000, Math.max(2, Math.floor(anchorCount))),
      roundness: Math.min(100, Math.max(0, roundness)),
      enabled,
    };
  }
  if (value['type'] === 'boolean') {
    const operation = value['operation'];
    if (operation !== 'union' && operation !== 'difference' && operation !== 'intersect') {
      return null;
    }
    const id = claim(stringField(value, 'id'));
    const operandIndex = value['operandIndex'];
    if (typeof operandIndex === 'number' && Number.isInteger(operandIndex)) {
      operandLinks.push({ modifierId: id, operandIndex });
      return { id, type: 'boolean', operation, operandId: '', enabled };
    }
    const operandId = stringField(value, 'operandId');
    if (!operandId) {
      return null;
    }
    return { id, type: 'boolean', operation, operandId, enabled };
  }
  if (value['type'] === 'trace') {
    const settings = clampTraceSettings({
      mode:
        value['mode'] === 'colorDistance' || value['mode'] === 'grayscale' || value['mode'] === 'blackAndWhite' ? value['mode'] : 'color',
      colors: finiteField(value, 'colors', 16),
      threshold: finiteField(value, 'threshold', 128),
      paths: finiteField(value, 'paths', 50),
      corners: finiteField(value, 'corners', 75),
      noise: finiteField(value, 'noise', 10),
      optimization: finiteField(value, 'optimization', 0),
      ignoreWhite: booleanField(value, 'ignoreWhite') === true,
    });
    const view = value['view'];
    const regions = readTraceRegions(value['regions'], claim);
    return {
      id: claim(stringField(value, 'id')),
      type: 'trace',
      ...settings,
      view: view === 'outlines' || view === 'source' ? view : 'result',
      regions,
      ...(value['fault'] === 'unread' && regions.length === 0 ? { fault: 'unread' as const } : {}),
      enabled,
    };
  }
  return null;
}

function readTraceRegions(value: unknown, claim: (id: string | null) => string): TraceRegion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const fill = stringField(item, 'fill')?.toLowerCase();
    const source = readSource(item['source']);
    if (!fill || !/^#[0-9a-f]{6}$/.test(fill) || !source || source.subpaths.length === 0) {
      return [];
    }
    return [{ fill, source: claimSource(source, claim) }];
  });
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
    originX: finiteField(value, 'originX', 0),
    originY: finiteField(value, 'originY', 0),
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

function readGradients(svg: Element, used: Set<string>): Document['gradients'] {
  const elements = [...svg.getElementsByTagName('linearGradient'), ...svg.getElementsByTagName('radialGradient')];
  return elements.flatMap((element) => {
    const stopElements = [...element.getElementsByTagName('stop')];
    const stops = stopElements.flatMap((stop, index) => {
      const color = stopColor(stop);
      if (!color) {
        return [];
      }
      const rawOffset = stop.getAttribute('offset') ?? `${index / Math.max(1, stopElements.length - 1)}`;
      const offset = rawOffset.trim().endsWith('%') ? Number.parseFloat(rawOffset) / 100 : Number.parseFloat(rawOffset);
      const style = parseStyleAttribute(stop.getAttribute('style'));
      const opacity = Number.parseFloat(style['stop-opacity'] ?? stop.getAttribute('stop-opacity') ?? '1');
      return [
        {
          id: claimId(stop.getAttribute('data-vector-editor-stop'), used),
          offset: Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : 0,
          color,
          opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1,
        },
      ];
    });
    if (stops.length < 2) {
      return [];
    }
    const id = claimId(element.getAttribute('id'), used);
    const transform = element.getAttribute('gradientTransform') ?? '';
    const angle = Number.parseFloat(/rotate\(\s*(-?[\d.]+)/.exec(transform)?.[1] ?? '0');
    const scale = /scale\(\s*([\d.]+)(?:\s+([\d.]+))?/.exec(transform);
    const proportions = scale?.[1] ?? '1';
    return [
      {
        id,
        name: element.getAttribute('data-vector-editor-name') || 'Gradient',
        type: element.localName === 'radialGradient' ? 'radial' : 'linear',
        angle: Number.isFinite(angle) ? angle : 0,
        proportions: Number.isFinite(Number(proportions)) && Number(proportions) > 0 ? Number(proportions) : 1,
        stops,
      },
    ];
  });
}

function stopColor(stop: Element | undefined): string | null {
  if (!stop) {
    return null;
  }
  const style = parseStyleAttribute(stop.getAttribute('style'));
  const value = (style['stop-color'] ?? stop.getAttribute('stop-color') ?? '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) {
    return value;
  }
  return /^#[0-9a-f]{3}$/.test(value) ? `#${[...value.slice(1)].map((character) => `${character}${character}`).join('')}` : null;
}

function readStyle(element: Element, inherited: Style): Style {
  const inline = parseStyleAttribute(element.getAttribute('style'));
  const fill = paintValue(inline['fill'] ?? attributeValue(element, 'fill'), inherited.fill);
  const stroke = paintValue(inline['stroke'] ?? attributeValue(element, 'stroke'), inherited.stroke);
  const widthSource = inline['stroke-width'] ?? attributeValue(element, 'stroke-width');
  const ruleSource = inline['fill-rule'] ?? attributeValue(element, 'fill-rule');
  const linecapSource = inline['stroke-linecap'] ?? attributeValue(element, 'stroke-linecap');
  const linejoinSource = inline['stroke-linejoin'] ?? attributeValue(element, 'stroke-linejoin');
  const miterSource = inline['stroke-miterlimit'] ?? attributeValue(element, 'stroke-miterlimit');
  const opacitySource = inline['stroke-opacity'] ?? attributeValue(element, 'stroke-opacity');
  const dashSource = inline['stroke-dasharray'] ?? attributeValue(element, 'stroke-dasharray');
  const offsetSource = inline['stroke-dashoffset'] ?? attributeValue(element, 'stroke-dashoffset');
  return {
    fill,
    stroke,
    strokeWidth: widthSource === undefined ? inherited.strokeWidth : strokeWidth(widthSource, inherited.strokeWidth),
    strokeLinecap: readLinecap(linecapSource, inherited.strokeLinecap),
    strokeLinejoin: readLinejoin(linejoinSource, inherited.strokeLinejoin),
    strokeMiterlimit: readMiterlimit(miterSource, inherited.strokeMiterlimit),
    strokeOpacity: readStrokeOpacity(opacitySource, inherited.strokeOpacity),
    strokeDasharray: readDasharray(dashSource, inherited.strokeDasharray),
    strokeDashoffset: readDashoffset(offsetSource, inherited.strokeDashoffset),
    strokeAlign: inherited.strokeAlign,
    fillRule: ruleSource === 'evenodd' ? 'evenodd' : ruleSource === 'nonzero' ? 'nonzero' : inherited.fillRule,
  };
}

function paintValue(value: string | undefined, fallback: string | null): string | null {
  if (value === undefined || value === 'inherit') {
    return fallback;
  }
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'none' || trimmed === 'transparent') {
    return null;
  }
  if (/^url\(#[a-z0-9_-]+\)$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^url\(/i.test(trimmed)) {
    return null;
  }
  if (trimmed.toLowerCase() === 'currentcolor') {
    return '#000000';
  }
  return trimmed;
}

function readStrokeAlign(value: unknown): Style['strokeAlign'] {
  return value === 'inside' || value === 'outside' || value === 'default' ? value : 'default';
}

function readPayloadWidth(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function readPayloadStroke(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function strokeWidth(value: string, fallback: number): number {
  if (value.trim().endsWith('%')) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readLinecap(value: string | undefined, inherited: Style['strokeLinecap']): Style['strokeLinecap'] {
  if (value === undefined || value.trim().toLowerCase() === 'inherit') {
    return inherited;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === 'butt' || trimmed === 'round' || trimmed === 'square' ? trimmed : inherited;
}

function readLinejoin(value: string | undefined, inherited: Style['strokeLinejoin']): Style['strokeLinejoin'] {
  if (value === undefined || value.trim().toLowerCase() === 'inherit') {
    return inherited;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === 'miter' || trimmed === 'round' || trimmed === 'bevel' ? trimmed : 'miter';
}

function readMiterlimit(value: string | undefined, inherited: number): number {
  if (value === undefined || value.trim().toLowerCase() === 'inherit' || value.trim().endsWith('%')) {
    return inherited;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : inherited;
}

function readStrokeOpacity(value: string | undefined, inherited: number): number {
  if (value === undefined || value.trim().toLowerCase() === 'inherit') {
    return inherited;
  }
  const trimmed = value.trim();
  const parsed = trimmed.endsWith('%') ? Number.parseFloat(trimmed) / 100 : Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return inherited;
  }
  return Math.min(1, Math.max(0, parsed));
}

function readDashoffset(value: string | undefined, inherited: number): number {
  if (value === undefined || value.trim().toLowerCase() === 'inherit' || value.trim().endsWith('%')) {
    return inherited;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : inherited;
}

function readDasharray(value: string | undefined, inherited: readonly number[] | null): readonly number[] | null {
  if (value === undefined || value.trim().toLowerCase() === 'inherit') {
    return inherited;
  }
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none') {
    return null;
  }
  if (trimmed.includes('%')) {
    return inherited;
  }
  const numbers = trimmed
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
    .map((part) => Number.parseFloat(part));
  if (numbers.length === 0 || numbers.some((length) => !Number.isFinite(length) || length < 0)) {
    return inherited;
  }
  return numbers;
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
    if (values.length === 4 && values.every((value) => Number.isFinite(value)) && values[2] > 0 && values[3] > 0) {
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
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}
