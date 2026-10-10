import { ClipperHold, evaluateDocument } from '@vector-editor/core';
import { isEmptyPoint } from '@vector-editor/modules/empty-point';
import { isImage } from '@vector-editor/modules/image';
import { enabledTrace, tracePreview } from '@vector-editor/modules/image-trace';
import { objectsInPaintOrder } from '@vector-editor/modules/paint-order';
import { sourceToPathData } from '@vector-editor/modules/path-data';
import {
  Document,
  Gradient,
  ObjectTransform,
  Style,
  Subpath,
  ViewBox,
} from '@vector-editor/modules/types';

export type SceneSurface = 'viewport' | 'preview';

export interface SceneMaskRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneTracePath {
  readonly d: string;
  readonly fill: string;
}

export interface SceneObject {
  readonly id: string;
  readonly kind: 'path' | 'image';
  readonly d: string;
  readonly tracePaths: readonly SceneTracePath[];
  readonly traceOutlines: boolean;
  readonly href: string | null;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly preserveAspectRatio: string | null;
  readonly transform: string;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly strokeLinecap: Style['strokeLinecap'];
  readonly strokeLinejoin: Style['strokeLinejoin'];
  readonly strokeMiterlimit: number;
  readonly strokeOpacity: number;
  readonly strokeDasharray: string;
  readonly strokeDashoffset: number;
  readonly strokeAlign: 'default' | 'inside' | 'outside';
  readonly clipId: string | null;
  readonly maskId: string | null;
  readonly maskRect: SceneMaskRect | null;
  readonly fillRule: 'nonzero' | 'evenodd';
}

export interface Scene {
  readonly viewBox: ViewBox;
  readonly gradients: readonly Gradient[];
  readonly objects: readonly SceneObject[];
}

export function gradientTransform(gradient: Gradient): string {
  return gradient.type === 'linear'
    ? `rotate(${gradient.angle} 0.5 0.5) scale(${gradient.proportions} 1)`
    : `translate(0.5 0.5) scale(${gradient.proportions} 1) translate(-0.5 -0.5)`;
}

export function gradientBackground(gradient: Gradient): string {
  const stops = gradient.stops.map(
    (stop) =>
      `color-mix(in srgb, ${stop.color} ${Math.round(stop.opacity * 100)}%, transparent) ${Math.round(stop.offset * 100)}%`,
  );
  return gradient.type === 'linear'
    ? `linear-gradient(${gradient.angle + 90}deg, ${stops.join(', ')})`
    : `radial-gradient(ellipse ${gradient.proportions * 100}% 100% at center, ${stops.join(', ')})`;
}

export function effectiveStrokeAlign(
  style: Style,
  subpaths: readonly Pick<Subpath, 'closed'>[],
): 'default' | 'inside' | 'outside' {
  if (style.strokeAlign === 'default' || style.stroke === null || style.strokeWidth <= 0) {
    return 'default';
  }
  if (subpaths.length === 0 || subpaths.some((subpath) => !subpath.closed)) {
    return 'default';
  }
  return style.strokeAlign;
}

export function sceneFromDocument(
  document: Document,
  hold: ClipperHold | null = null,
  surface: SceneSurface = 'viewport',
): Scene {
  const geometry = new Map(
    evaluateDocument(document.objects, hold).map((item) => [item.objectId, item]),
  );
  return {
    viewBox: document.viewBox,
    gradients: document.gradients,
    objects: objectsInPaintOrder(document).flatMap((object): SceneObject[] => {
      if (isEmptyPoint(object)) {
        return [];
      }
      if (isImage(object)) {
        const image = object.image;
        if (!image) {
          return [];
        }
        const trace = enabledTrace(object);
        const preview = trace ? tracePreview(trace) : null;
        return [
          {
            id: object.id,
            kind: 'image' as const,
            d: '',
            tracePaths: preview?.paths ?? [],
            traceOutlines: preview?.outlines ?? false,
            href: preview ? null : image.dataUrl || null,
            imageWidth: image.width,
            imageHeight: image.height,
            preserveAspectRatio: image.preserveAspectRatio,
            transform: formatObjectTransform(object.transform),
            fill: 'none',
            stroke: 'none',
            strokeWidth: 0,
            strokeLinecap: object.style.strokeLinecap,
            strokeLinejoin: object.style.strokeLinejoin,
            strokeMiterlimit: object.style.strokeMiterlimit,
            strokeOpacity: object.style.strokeOpacity,
            strokeDasharray: 'none',
            strokeDashoffset: 0,
            strokeAlign: 'default' as const,
            clipId: null,
            maskId: null,
            maskRect: null,
            fillRule: object.style.fillRule,
          },
        ];
      }
      const evaluated = geometry.get(object.id);
      const subpaths = evaluated?.subpaths ?? object.source.subpaths;
      const strokeAlign = effectiveStrokeAlign(object.style, subpaths);
      const maskRect =
        strokeAlign === 'outside' ? outsideMaskRect(subpaths, object.style.strokeWidth) : null;
      const paintAlign = maskRect === null && strokeAlign === 'outside' ? 'default' : strokeAlign;
      return [
        {
          id: object.id,
          kind: 'path' as const,
          d: sourceToPathData({ subpaths }),
          tracePaths: [],
          traceOutlines: false,
          href: null,
          imageWidth: 0,
          imageHeight: 0,
          preserveAspectRatio: null,
          transform: formatObjectTransform(object.transform),
          fill: object.style.fill ?? 'none',
          stroke: object.style.stroke ?? 'none',
          strokeWidth: object.style.strokeWidth,
          strokeLinecap: object.style.strokeLinecap,
          strokeLinejoin: object.style.strokeLinejoin,
          strokeMiterlimit: object.style.strokeMiterlimit,
          strokeOpacity: object.style.strokeOpacity,
          strokeDasharray: formatDasharray(object.style.strokeDasharray),
          strokeDashoffset: object.style.strokeDashoffset,
          strokeAlign: paintAlign,
          clipId: paintAlign === 'inside' ? `stroke-clip-${surface}-${object.id}` : null,
          maskId: paintAlign === 'outside' ? `stroke-mask-${surface}-${object.id}` : null,
          maskRect: paintAlign === 'outside' ? maskRect : null,
          fillRule: evaluated?.fillRule ?? object.style.fillRule,
        },
      ];
    }),
  };
}

function outsideMaskRect(subpaths: readonly Subpath[], strokeWidth: number): SceneMaskRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const subpath of subpaths) {
    for (const anchor of subpath.anchors) {
      for (const point of [anchor.position, anchor.handleIn, anchor.handleOut]) {
        if (!point) {
          continue;
        }
        found = true;
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
  }
  if (!found) {
    return null;
  }
  return {
    x: minX - strokeWidth,
    y: minY - strokeWidth,
    width: maxX - minX + strokeWidth * 2,
    height: maxY - minY + strokeWidth * 2,
  };
}

function formatDasharray(value: readonly number[] | null): string {
  return value === null ? 'none' : value.join(' ');
}

export function formatObjectTransform(transform: ObjectTransform): string {
  const translate = `translate(${transform.x} ${transform.y})`;
  const centerX = transform.originX * transform.scaleX;
  const centerY = transform.originY * transform.scaleY;
  const rotate =
    centerX === 0 && centerY === 0
      ? `rotate(${transform.rotation})`
      : `rotate(${transform.rotation} ${centerX} ${centerY})`;
  const scale = `scale(${transform.scaleX} ${transform.scaleY})`;
  return `${translate} ${rotate} ${scale}`;
}
