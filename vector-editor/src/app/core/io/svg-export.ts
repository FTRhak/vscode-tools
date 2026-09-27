import { evaluateObject } from '../eval/evaluate';
import { layersBackToFront, objectsInPaintOrder, objectsOnLayer } from '../model/paint-order';
import { sourceToPathData } from '../model/path-data';
import { Document, Layer, Modifier, SourcePath, VectorObject } from '../model/types';
import { matrixFromTransform, transformSource } from './matrix';

export type SaveMode = 'all' | 'optimized' | 'minimal';

const formatVersion = 1;

export function exportSvg(document: Document, mode: SaveMode): string {
  const lines = [svgOpen(document, mode)];
  if (mode === 'minimal') {
    for (const object of objectsInPaintOrder(document)) {
      lines.push(`  ${pathTag(object, mode)}`);
    }
  } else {
    const known = new Set(document.layers.map((layer) => layer.id));
    for (const layer of layersBackToFront(document)) {
      lines.push(`  ${groupOpen(layer, mode)}`);
      for (const object of objectsOnLayer(document, layer.id)) {
        lines.push(`    ${pathTag(object, mode)}`);
      }
      lines.push('  </g>');
    }
    const orphans = document.objects.filter((object) => !known.has(object.layerId));
    if (orphans.length > 0) {
      const label = escapeXml(JSON.stringify({ name: 'Layer', visible: true }));
      lines.push(`  <g data-vector-editor-layer="${label}">`);
      for (const object of orphans) {
        lines.push(`    ${pathTag(object, mode)}`);
      }
      lines.push('  </g>');
    }
  }
  lines.push('</svg>');
  return lines.join('\n');
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

function pathTag(object: VectorObject, mode: SaveMode): string {
  const geometry = transformSource(
    { subpaths: evaluateObject(object).subpaths },
    matrixFromTransform(object.transform),
  );
  const attributes = [
    mode === 'all' ? `id="${escapeXml(object.id)}"` : null,
    `d="${escapeXml(sourceToPathData(geometry))}"`,
    `fill="${escapeXml(object.style.fill ?? 'none')}"`,
    `stroke="${escapeXml(object.style.stroke ?? 'none')}"`,
    `stroke-width="${formatNumber(object.style.strokeWidth)}"`,
    `fill-rule="${object.style.fillRule}"`,
    object.visible ? null : 'display="none"',
    mode === 'minimal'
      ? null
      : `data-vector-editor="${escapeXml(JSON.stringify(objectPayload(object, mode)))}"`,
  ].filter((item): item is string => item !== null);
  return `<path ${attributes.join(' ')} />`;
}

function objectPayload(object: VectorObject, mode: SaveMode): unknown {
  const payload: {
    version: number;
    name: string;
    source: SourcePath | ReturnType<typeof indexedSource>;
    transform: VectorObject['transform'];
    modifiers: unknown[];
    locked?: boolean;
  } = {
    version: formatVersion,
    name: object.name,
    source: mode === 'all' ? object.source : indexedSource(object.source),
    transform: object.transform,
    modifiers: object.modifiers.map((modifier) => modifierPayload(modifier, mode)),
  };
  if (mode === 'all') {
    payload.locked = object.locked;
  }
  return payload;
}

function modifierPayload(modifier: Modifier, mode: SaveMode): unknown {
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
    case 'mirror':
      return { type: modifier.type, axis: modifier.axis, enabled: modifier.enabled };
    case 'bevel':
      return {
        type: modifier.type,
        distance: modifier.distance,
        join: modifier.join,
        miterLimit: modifier.miterLimit,
        enabled: modifier.enabled,
      };
    case 'boolean':
      return {
        type: modifier.type,
        operation: modifier.operation,
        operandId: modifier.operandId,
        enabled: modifier.enabled,
      };
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
