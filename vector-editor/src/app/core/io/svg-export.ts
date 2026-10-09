import { sourceBounds } from '../eval/bounds';
import { evaluateDocument, EvaluatedGeometry } from '../eval/evaluate';
import { isEmptyPoint } from '../model/empty-point';
import { layersBackToFront, objectsInPaintOrder, objectsOnLayer } from '../model/paint-order';
import { sourceToPathData } from '../model/path-data';
import { Document, Layer, Modifier, SourcePath, Style, VectorObject } from '../model/types';
import { matrixFromTransform, transformSource } from './matrix';

export type SaveMode = 'all' | 'optimized' | 'minimal';

const formatVersion = 1;

export function exportSvg(document: Document, mode: SaveMode): string {
  const geometry = new Map(evaluateDocument(document.objects).map((item) => [item.objectId, item]));
  const order = exportedObjects(document);
  const defs = gradientDefs(document);
  const ids = { next: 0 };
  const body: string[] = [];
  if (mode === 'minimal') {
    for (const object of objectsInPaintOrder(document)) {
      if (isEmptyPoint(object)) {
        continue;
      }
      body.push(block(pathTag(object, mode, geometry.get(object.id), order, defs, ids), '  '));
    }
  } else {
    const known = new Set(document.layers.map((layer) => layer.id));
    for (const layer of layersBackToFront(document)) {
      body.push(`  ${groupOpen(layer, mode)}`);
      for (const object of objectsOnLayer(document, layer.id)) {
        body.push(block(pathTag(object, mode, geometry.get(object.id), order, defs, ids), '    '));
      }
      body.push('  </g>');
    }
    const orphans = document.objects.filter((object) => !known.has(object.layerId));
    if (orphans.length > 0) {
      const label = escapeXml(JSON.stringify({ name: 'Layer', visible: true }));
      body.push(`  <g data-vector-editor-layer="${label}">`);
      for (const object of orphans) {
        body.push(block(pathTag(object, mode, geometry.get(object.id), order, defs, ids), '    '));
      }
      body.push('  </g>');
    }
  }
  const lines = [svgOpen(document, mode)];
  if (defs.length > 0) {
    lines.push('  <defs>', ...defs, '  </defs>');
  }
  lines.push(...body, '</svg>');
  return lines.join('\n');
}

function gradientDefs(document: Document): string[] {
  const defs: string[] = [];
  for (const gradient of document.gradients) {
    const transform =
      gradient.type === 'linear'
        ? `rotate(${formatNumber(gradient.angle)} 0.5 0.5) scale(${formatNumber(gradient.proportions)} 1)`
        : `translate(0.5 0.5) scale(${formatNumber(gradient.proportions)} 1) translate(-0.5 -0.5)`;
    const tag = gradient.type === 'linear' ? 'linearGradient' : 'radialGradient';
    defs.push(
      `    <${tag} id="${escapeXml(gradient.id)}" data-vector-editor-name="${escapeXml(gradient.name)}" gradientUnits="objectBoundingBox" gradientTransform="${transform}">`,
    );
    for (const stop of gradient.stops) {
      defs.push(
        `      <stop data-vector-editor-stop="${escapeXml(stop.id)}" offset="${formatNumber(stop.offset * 100)}%" stop-color="${escapeXml(stop.color)}" stop-opacity="${formatNumber(stop.opacity)}" />`,
      );
    }
    defs.push(`    </${tag}>`);
  }
  return defs;
}

function block(markup: string, pad: string): string {
  return markup
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

function exportedObjects(document: Document): readonly VectorObject[] {
  const known = new Set(document.layers.map((layer) => layer.id));
  const objects: VectorObject[] = [];
  for (const layer of layersBackToFront(document)) {
    objects.push(...objectsOnLayer(document, layer.id));
  }
  objects.push(...document.objects.filter((object) => !known.has(object.layerId)));
  return objects;
}

function svgOpen(document: Document, mode: SaveMode): string {
  const viewBox = `${formatNumber(document.viewBox.x)} ${formatNumber(document.viewBox.y)} ${formatNumber(document.viewBox.width)} ${formatNumber(document.viewBox.height)}`;
  const metadata =
    mode === 'minimal'
      ? ''
      : ` data-vector-editor-document="${escapeXml(JSON.stringify(documentPayload(document, mode)))}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${metadata}>`;
}

function documentPayload(document: Document, mode: SaveMode): unknown {
  if (mode === 'all') {
    return {
      version: formatVersion,
      id: document.id,
      name: document.name,
      swatches: document.swatches,
    };
  }
  return { version: formatVersion, name: document.name };
}

function groupOpen(layer: Layer, mode: SaveMode): string {
  const attributes = [
    mode === 'all' ? `id="${escapeXml(layer.id)}"` : null,
    layer.visible ? null : 'display="none"',
    `data-vector-editor-layer="${escapeXml(JSON.stringify(layerPayload(layer, mode)))}"`,
  ].filter((item): item is string => item !== null);
  return `<g ${attributes.join(' ')}>`;
}

function layerPayload(layer: Layer, mode: SaveMode): unknown {
  if (mode === 'all') {
    return { id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked };
  }
  return { name: layer.name, visible: layer.visible };
}

function pathTag(
  object: VectorObject,
  mode: SaveMode,
  evaluated: EvaluatedGeometry | undefined,
  order: readonly VectorObject[],
  defs: string[],
  ids: { next: number },
): string {
  if (isEmptyPoint(object)) {
    const attributes = [
      mode === 'all' ? `id="${escapeXml(object.id)}"` : null,
      `d="M ${formatNumber(object.transform.x)} ${formatNumber(object.transform.y)}"`,
      'fill="none"',
      'stroke="none"',
      'stroke-width="0"',
      'fill-rule="nonzero"',
      object.visible ? null : 'display="none"',
      `data-vector-editor="${escapeXml(JSON.stringify(objectPayload(object, mode, order)))}"`,
    ].filter((item): item is string => item !== null);
    return `<path ${attributes.join(' ')} />`;
  }
  const local = { subpaths: evaluated?.subpaths ?? object.source.subpaths };
  const geometry = transformSource(local, matrixFromTransform(object.transform));
  const align = exportStrokeAlign(object.style, local.subpaths);
  const d = escapeXml(sourceToPathData(geometry));
  const rule = evaluated?.fillRule ?? object.style.fillRule;
  if (align === 'inside') {
    return insideStrokeTag(object, mode, order, defs, ids, d, rule);
  }
  if (align === 'outside') {
    return outsideStrokeTag(object, mode, order, defs, ids, geometry, d, rule);
  }
  return centeredStrokeTag(object, mode, order, d, rule);
}

function centeredStrokeTag(
  object: VectorObject,
  mode: SaveMode,
  order: readonly VectorObject[],
  d: string,
  rule: Style['fillRule'],
): string {
  const attributes = [
    mode === 'all' ? `id="${escapeXml(object.id)}"` : null,
    `d="${d}"`,
    `fill="${escapeXml(object.style.fill ?? 'none')}"`,
    `stroke="${escapeXml(object.style.stroke ?? 'none')}"`,
    `stroke-width="${formatNumber(object.style.strokeWidth)}"`,
    ...strokePaintAttributes(object.style),
    `fill-rule="${rule}"`,
    object.visible ? null : 'display="none"',
    editorPayload(object, mode, order),
  ].filter((item): item is string => item !== null);
  return `<path ${attributes.join(' ')} />`;
}

function insideStrokeTag(
  object: VectorObject,
  mode: SaveMode,
  order: readonly VectorObject[],
  defs: string[],
  ids: { next: number },
  d: string,
  rule: Style['fillRule'],
): string {
  const id = ids.next;
  ids.next += 1;
  defs.push(
    `    <clipPath id="stroke-clip-${id}" clipPathUnits="userSpaceOnUse">`,
    `      <path d="${d}" fill-rule="${rule}"/>`,
    `    </clipPath>`,
  );
  const attributes = [
    mode === 'all' ? `id="${escapeXml(object.id)}"` : null,
    `d="${d}"`,
    `fill="${escapeXml(object.style.fill ?? 'none')}"`,
    `stroke="${escapeXml(object.style.stroke ?? 'none')}"`,
    `stroke-width="${formatNumber(object.style.strokeWidth * 2)}"`,
    ...strokePaintAttributes(object.style),
    `fill-rule="${rule}"`,
    `clip-path="url(#stroke-clip-${id})"`,
    object.visible ? null : 'display="none"',
    editorPayload(object, mode, order, { strokeWidth: object.style.strokeWidth }),
  ].filter((item): item is string => item !== null);
  return `<path ${attributes.join(' ')} />`;
}

function outsideStrokeTag(
  object: VectorObject,
  mode: SaveMode,
  order: readonly VectorObject[],
  defs: string[],
  ids: { next: number },
  geometry: SourcePath,
  d: string,
  rule: Style['fillRule'],
): string {
  const bounds = sourceBounds(geometry);
  if (!bounds || object.style.stroke === null) {
    return centeredStrokeTag(object, mode, order, d, rule);
  }
  const id = ids.next;
  ids.next += 1;
  const pad = object.style.strokeWidth;
  const x = formatNumber(bounds.minX - pad);
  const y = formatNumber(bounds.minY - pad);
  const width = formatNumber(bounds.maxX - bounds.minX + pad * 2);
  const height = formatNumber(bounds.maxY - bounds.minY + pad * 2);
  const stroke = escapeXml(object.style.stroke);
  defs.push(
    `    <mask id="stroke-mask-${id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}">`,
    `      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>`,
    `      <path d="${d}" fill="black" fill-rule="${rule}"/>`,
    `    </mask>`,
    `    <path id="stroke-paint-${id}" d="${d}" fill="none" stroke="${stroke}" stroke-width="${formatNumber(pad * 2)}" ${strokePaintAttributes(object.style).join(' ')} mask="url(#stroke-mask-${id})"/>`,
  );
  const attributes = [
    mode === 'all' ? `id="${escapeXml(object.id)}"` : null,
    `d="${d}"`,
    `fill="${escapeXml(object.style.fill ?? 'none')}"`,
    'stroke="none"',
    `stroke-width="${formatNumber(object.style.strokeWidth)}"`,
    ...strokePaintAttributes(object.style),
    `fill-rule="${rule}"`,
    object.visible ? null : 'display="none"',
    editorPayload(object, mode, order, {
      strokeWidth: object.style.strokeWidth,
      stroke: object.style.stroke,
    }),
  ].filter((item): item is string => item !== null);
  const hidden = object.visible ? '' : ' display="none"';
  return `<path ${attributes.join(' ')} />\n<use href="#stroke-paint-${id}"${hidden}/>`;
}

function editorPayload(
  object: VectorObject,
  mode: SaveMode,
  order: readonly VectorObject[],
  paint?: { readonly strokeWidth?: number; readonly stroke?: string | null },
): string | null {
  if (mode === 'minimal') {
    return null;
  }
  return `data-vector-editor="${escapeXml(JSON.stringify(objectPayload(object, mode, order, paint)))}"`;
}

function exportStrokeAlign(
  style: Style,
  subpaths: readonly { closed: boolean }[],
): 'default' | 'inside' | 'outside' {
  if (style.strokeAlign === 'default' || style.stroke === null || style.strokeWidth <= 0) {
    return 'default';
  }
  if (subpaths.length === 0 || subpaths.some((subpath) => !subpath.closed)) {
    return 'default';
  }
  return style.strokeAlign;
}

function objectPayload(
  object: VectorObject,
  mode: SaveMode,
  order: readonly VectorObject[],
  paint?: { readonly strokeWidth?: number; readonly stroke?: string | null },
): unknown {
  const payload: {
    version: number;
    name: string;
    kind?: 'empty';
    source: SourcePath | ReturnType<typeof indexedSource>;
    transform: VectorObject['transform'];
    modifiers: unknown[];
    locked?: boolean;
    strokeAlign?: Style['strokeAlign'];
    strokeWidth?: number;
    stroke?: string | null;
  } = {
    version: formatVersion,
    name: object.name,
    source: mode === 'all' ? object.source : indexedSource(object.source),
    transform: object.transform,
    modifiers: object.modifiers.flatMap((modifier) => {
      const payload = modifierPayload(modifier, mode, order);
      return payload === null ? [] : [payload];
    }),
  };
  if (isEmptyPoint(object)) {
    payload.kind = 'empty';
  }
  if (mode === 'all') {
    payload.locked = object.locked;
  }
  if (object.style.strokeAlign !== 'default') {
    payload.strokeAlign = object.style.strokeAlign;
  }
  if (paint?.strokeWidth !== undefined) {
    payload.strokeWidth = paint.strokeWidth;
  }
  if (paint && 'stroke' in paint) {
    payload.stroke = paint.stroke;
  }
  return payload;
}

function modifierPayload(
  modifier: Modifier,
  mode: SaveMode,
  order: readonly VectorObject[],
): unknown | null {
  if (mode === 'all') {
    return modifier;
  }
  switch (modifier.type) {
    case 'array':
      return {
        type: modifier.type,
        count: modifier.count,
        offsetX: modifier.offsetX,
        offsetY: modifier.offsetY,
        enabled: modifier.enabled,
      };
    case 'mirror': {
      const centerPointIndex = order.findIndex(
        (item) => item.id === modifier.centerPointId && isEmptyPoint(item),
      );
      return {
        type: modifier.type,
        axis: modifier.axis,
        ...(centerPointIndex >= 0 ? { centerPointIndex } : {}),
        enabled: modifier.enabled,
      };
    }
    case 'bevel':
      return {
        type: modifier.type,
        distance: modifier.distance,
        join: modifier.join,
        miterLimit: modifier.miterLimit,
        enabled: modifier.enabled,
      };
    case 'round':
      return {
        type: modifier.type,
        mode: modifier.mode,
        anchorCount: modifier.anchorCount,
        roundness: modifier.roundness,
        enabled: modifier.enabled,
      };
    case 'boolean': {
      const operandIndex = order.findIndex((item) => item.id === modifier.operandId);
      if (operandIndex < 0) {
        return null;
      }
      return {
        type: modifier.type,
        operation: modifier.operation,
        operandIndex,
        enabled: modifier.enabled,
      };
    }
  }
}

function indexedSource(source: SourcePath): {
  subpaths: Array<{
    closed: boolean;
    anchors: Array<{
      position: VectorObject['source']['subpaths'][number]['anchors'][number]['position'];
      handleIn: VectorObject['source']['subpaths'][number]['anchors'][number]['handleIn'];
      handleOut: VectorObject['source']['subpaths'][number]['anchors'][number]['handleOut'];
    }>;
    segments: Array<{ kind: 'line' | 'cubic'; from: number; to: number }>;
  }>;
} {
  return {
    subpaths: source.subpaths.map((subpath) => ({
      closed: subpath.closed,
      anchors: subpath.anchors.map((anchor) => ({
        position: anchor.position,
        handleIn: anchor.handleIn,
        handleOut: anchor.handleOut,
      })),
      segments: subpath.segments.map((segment) => ({
        kind: segment.kind,
        from: subpath.anchors.findIndex((anchor) => anchor.id === segment.fromId),
        to: subpath.anchors.findIndex((anchor) => anchor.id === segment.toId),
      })),
    })),
  };
}

function strokePaintAttributes(style: Style): readonly string[] {
  const dashes =
    style.strokeDasharray === null
      ? 'none'
      : style.strokeDasharray.map((length) => formatNumber(length)).join(' ');
  return [
    `stroke-linecap="${style.strokeLinecap}"`,
    `stroke-linejoin="${style.strokeLinejoin}"`,
    `stroke-miterlimit="${formatNumber(style.strokeMiterlimit)}"`,
    `stroke-opacity="${formatNumber(style.strokeOpacity)}"`,
    `stroke-dasharray="${dashes}"`,
    `stroke-dashoffset="${formatNumber(style.strokeDashoffset)}"`,
  ];
}

function formatNumber(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
