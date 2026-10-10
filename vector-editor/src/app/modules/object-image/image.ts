import { createId } from '@vector-editor/core/utils';
import { nextSeriesName } from '../document-edits';
import {
  Document,
  ImageAspect,
  ImageContent,
  ImageMime,
  ImagePlacement,
  ObjectTransform,
  SourcePath,
  Style,
  svgStrokeDefaults,
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

const imageMimes = new Set<ImageMime>(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export interface ImageDraft {
  readonly name: string;
  readonly placement: ImagePlacement;
  readonly fileName: string;
  readonly mime: ImageMime;
  readonly dataUrl: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly preserveAspectRatio: ImageAspect;
}

export interface ImageObjectResult {
  readonly document: Document;
  readonly objectId: string;
}

export function isImage(object: VectorObject): boolean {
  return object.kind === 'image';
}

export function isImageMime(value: string): value is ImageMime {
  return imageMimes.has(value as ImageMime);
}

export function imageObjectName(fileName: string): string {
  const base = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, '')
    .trim();
  return base || 'Image';
}

export function addImage(
  document: Document,
  draft: ImageDraft,
  layerId?: string,
): ImageObjectResult | null {
  const image = imageContent(draft);
  if (
    !image ||
    !Number.isFinite(draft.x) ||
    !Number.isFinite(draft.y) ||
    !draft.name.trim()
  ) {
    return null;
  }
  const layer = imageLayer(document, layerId);
  if (!layer || layer.locked || !layer.visible) {
    return null;
  }
  const objectId = createId();
  const object: VectorObject = {
    id: objectId,
    name: nextSeriesName(
      document.objects.map((item) => item.name),
      draft.name.trim(),
    ),
    layerId: layer.id,
    visible: true,
    locked: false,
    kind: 'image',
    source: emptySource,
    image,
    style: emptyStyle,
    transform: { ...identityTransform, x: draft.x, y: draft.y },
    modifiers: [],
  };
  return {
    document: { ...document, objects: [...document.objects, object] },
    objectId,
  };
}

export function imageContent(draft: ImageDraft): ImageContent | null {
  if (
    (draft.placement !== 'embed' && draft.placement !== 'link') ||
    !isImageMime(draft.mime) ||
    (draft.preserveAspectRatio !== 'xMidYMid meet' && draft.preserveAspectRatio !== 'none') ||
    !positive(draft.pixelWidth) ||
    !positive(draft.pixelHeight) ||
    !positive(draft.width) ||
    !positive(draft.height) ||
    (draft.dataUrl ? !isImageDataUrl(draft.dataUrl, draft.mime) : draft.placement !== 'link')
  ) {
    return null;
  }
  const fileName = safeImageFileName(draft.fileName, draft.mime);
  if (!fileName) {
    return null;
  }
  return {
    placement: draft.placement,
    fileName,
    mime: draft.mime,
    dataUrl: draft.dataUrl,
    pixelWidth: draft.pixelWidth,
    pixelHeight: draft.pixelHeight,
    width: draft.width,
    height: draft.height,
    preserveAspectRatio: draft.preserveAspectRatio,
  };
}

export function isImageDataUrl(value: string, mime: ImageMime): boolean {
  const prefix = `data:${mime};base64,`;
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    return false;
  }
  return /^[a-z0-9+/]+={0,2}$/i.test(value.slice(prefix.length));
}

export function safeImageFileName(name: string, mime: ImageMime): string | null {
  const base = name.split(/[\\/]/).pop()?.replace(/[\\/:*?"<>|]/g, '').trim() ?? '';
  if (!base || base === '.' || base === '..' || base.includes('..')) {
    return `image.${imageExtension(mime)}`;
  }
  return base.includes('.') ? base : `${base}.${imageExtension(mime)}`;
}

export function imageExtension(mime: ImageMime): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function imageLayer(document: Document, layerId: string | undefined) {
  if (layerId !== undefined) {
    return document.layers.find((layer) => layer.id === layerId);
  }
  return [...document.layers].sort((left, right) => left.order - right.order)[0];
}
