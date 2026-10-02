import {
  ClipperHold,
  Document,
  evaluateDocument,
  Gradient,
  isEmptyPoint,
  ObjectTransform,
  objectsInPaintOrder,
  sourceToPathData,
  ViewBox,
} from '@vector-editor/core';

export interface SceneObject {
  readonly id: string;
  readonly d: string;
  readonly transform: string;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
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

export function sceneFromDocument(document: Document, hold: ClipperHold | null = null): Scene {
  const geometry = new Map(
    evaluateDocument(document.objects, hold).map((item) => [item.objectId, item]),
  );
  return {
    viewBox: document.viewBox,
    gradients: document.gradients,
    objects: objectsInPaintOrder(document).flatMap((object) => {
      if (isEmptyPoint(object)) {
        return [];
      }
      const evaluated = geometry.get(object.id);
      return [{
        id: object.id,
        d: sourceToPathData({ subpaths: evaluated?.subpaths ?? object.source.subpaths }),
        transform: formatObjectTransform(object.transform),
        fill: object.style.fill ?? 'none',
        stroke: object.style.stroke ?? 'none',
        strokeWidth: object.style.strokeWidth,
        fillRule: evaluated?.fillRule ?? object.style.fillRule,
      }];
    }),
  };
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
