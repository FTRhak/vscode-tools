import { EndType, inflatePaths, JoinType } from 'clipper2-ts';
import { Modifier, SourcePath } from '@vector-editor/modules/types/types';
import { CLIPPER_SCALE, flattenSource, sourceFromPaths } from './flatten';

type BevelModifier = Extract<Modifier, { type: 'bevel' }>;

const ARC_TOLERANCE = 0.25 * CLIPPER_SCALE;

export function applyBevel(source: SourcePath, modifier: BevelModifier): SourcePath | null {
  if (!Number.isFinite(modifier.distance) || modifier.distance === 0) {
    return source;
  }
  const flat = flattenSource(source);
  const closed = flat
    .filter((path) => path.closed && path.points.length >= 3)
    .map((path) => path.points);
  const open = flat
    .filter((path) => !path.closed && path.points.length >= 2)
    .map((path) => path.points);
  const join = joinType(modifier.join);
  const miterLimit = modifier.miterLimit > 0 ? modifier.miterLimit : 2;
  try {
    const closedPaths =
      closed.length === 0
        ? []
        : inflatePaths(
            closed,
            modifier.distance * CLIPPER_SCALE,
            join,
            EndType.Polygon,
            miterLimit,
            ARC_TOLERANCE,
          );
    const openPaths =
      open.length === 0
        ? []
        : inflatePaths(
            open,
            Math.abs(modifier.distance) * CLIPPER_SCALE,
            join,
            EndType.Round,
            miterLimit,
            ARC_TOLERANCE,
          );
    return sourceFromPaths([...closedPaths, ...openPaths], modifier.id);
  } catch {
    return null;
  }
}

function joinType(join: BevelModifier['join']): JoinType {
  switch (join) {
    case 'miter':
      return JoinType.Miter;
    case 'round':
      return JoinType.Round;
    case 'bevel':
      return JoinType.Bevel;
  }
}
