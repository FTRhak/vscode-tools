import { Modifier, SourcePath } from '@vector-editor/modules/types/types';
import { mapSubpath } from './copy-subpath';

type ArrayModifier = Extract<Modifier, { type: 'array' }>;

export function applyArray(source: SourcePath, modifier: ArrayModifier): SourcePath {
  const count = arrayCount(modifier.count);
  if (count === 1 || source.subpaths.length === 0) {
    return source;
  }

  const subpaths = [...source.subpaths];
  for (let replica = 1; replica < count; replica += 1) {
    const dx = replica * modifier.offsetX;
    const dy = replica * modifier.offsetY;
    for (const subpath of source.subpaths) {
      subpaths.push(
        mapSubpath(subpath, modifier.id, String(replica), (point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      );
    }
  }
  return { subpaths };
}

export function arrayCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 1;
  }
  return Math.max(1, Math.floor(count));
}
