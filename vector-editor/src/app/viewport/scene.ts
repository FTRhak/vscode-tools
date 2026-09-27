import { Document, ObjectTransform, sourceToPathData, ViewBox } from '@vector-editor/core';

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
  readonly objects: readonly SceneObject[];
}

export function sceneFromDocument(document: Document): Scene {
  return {
    viewBox: document.viewBox,
    objects: document.objects
      .filter((object) => object.visible)
      .map((object) => ({
        id: object.id,
        d: sourceToPathData(object.source),
        transform: objectTransform(object.transform),
        fill: object.style.fill ?? 'none',
        stroke: object.style.stroke ?? 'none',
        strokeWidth: object.style.strokeWidth,
        fillRule: object.style.fillRule,
      })),
  };
}

function objectTransform(transform: ObjectTransform): string {
  const translate = `translate(${transform.x} ${transform.y})`;
  const rotate = `rotate(${transform.rotation})`;
  const scale = `scale(${transform.scaleX} ${transform.scaleY})`;
  return `${translate} ${rotate} ${scale}`;
}
