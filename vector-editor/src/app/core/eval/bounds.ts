import { applyMatrix, matrixFromTransform } from '../io/matrix';
import { isEmptyPoint } from '@vector-editor/modules/empty-point';
import { isImage } from '@vector-editor/modules/image';
import { SourcePath, Vec2, VectorObject } from '@vector-editor/modules/types';
import { collectPoints } from './flatten';

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function sourceBounds(source: SourcePath): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  const include = (point: Vec2): void => {
    found = true;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  };

  for (const subpath of source.subpaths) {
    for (const anchor of subpath.anchors) {
      include(anchor.position);
      if (anchor.handleIn) {
        include(anchor.handleIn);
      }
      if (anchor.handleOut) {
        include(anchor.handleOut);
      }
    }
  }

  return found ? { minX, minY, maxX, maxY } : null;
}

/** Axis-aligned document bounds of the evaluated path, ignoring handles and stroke. */
export function documentBounds(object: VectorObject, evaluated?: SourcePath): Bounds | null {
  if (isEmptyPoint(object)) {
    const { x, y } = object.transform;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { minX: x, minY: y, maxX: x, maxY: y };
  }

  if (isImage(object)) {
    const image = object.image;
    if (!image) {
      return null;
    }
    const matrix = matrixFromTransform(object.transform);
    const corners = [
      { x: 0, y: 0 },
      { x: image.width, y: 0 },
      { x: image.width, y: image.height },
      { x: 0, y: image.height },
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const corner of corners) {
      const world = applyMatrix(matrix, corner);
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) {
        return null;
      }
      minX = Math.min(minX, world.x);
      minY = Math.min(minY, world.y);
      maxX = Math.max(maxX, world.x);
      maxY = Math.max(maxY, world.y);
    }
    return { minX, minY, maxX, maxY };
  }

  const matrix = matrixFromTransform(object.transform);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const subpath of (evaluated ?? object.source).subpaths) {
    for (const point of collectPoints(subpath)) {
      const world = applyMatrix(matrix, point);
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) {
        continue;
      }
      found = true;
      minX = Math.min(minX, world.x);
      minY = Math.min(minY, world.y);
      maxX = Math.max(maxX, world.x);
      maxY = Math.max(maxY, world.y);
    }
  }
  return found ? { minX, minY, maxX, maxY } : null;
}
