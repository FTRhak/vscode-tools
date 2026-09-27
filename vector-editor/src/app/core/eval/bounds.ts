import { SourcePath, Vec2 } from '../model/types';

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
