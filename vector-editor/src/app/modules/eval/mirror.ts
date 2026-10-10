import { Modifier, SourcePath, Vec2 } from '@vector-editor/modules/types';
import { sourceBounds } from './bounds';
import { mapSubpath } from './copy-subpath';

type MirrorModifier = Extract<Modifier, { type: 'mirror' }>;

export function applyMirror(source: SourcePath, modifier: MirrorModifier, center?: Vec2): SourcePath {
  if (modifier.axis === 'none') {
    return source;
  }
  const bounds = sourceBounds(source);
  if (!bounds || source.subpaths.length === 0) {
    return source;
  }

  const centerX = center?.x ?? (bounds.minX + bounds.maxX) / 2;
  const centerY = center?.y ?? (bounds.minY + bounds.maxY) / 2;
  const copies = source.subpaths.map((subpath) =>
    mapSubpath(subpath, modifier.id, 'mirror', (point) => reflectPoint(point, modifier.axis, centerX, centerY)),
  );
  return { subpaths: [...source.subpaths, ...copies] };
}

function reflectPoint(point: Vec2, axis: MirrorModifier['axis'], centerX: number, centerY: number): Vec2 {
  return {
    x: axis === 'y' || axis === 'xy' ? 2 * centerX - point.x : point.x,
    y: axis === 'x' || axis === 'xy' ? 2 * centerY - point.y : point.y,
  };
}
