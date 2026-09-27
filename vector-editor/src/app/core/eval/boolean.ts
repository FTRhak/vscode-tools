import { difference, FillRule, intersect, union } from 'clipper2-ts';
import { invertMatrix, matrixFromTransform, multiplyMatrix, transformSource } from '../io/matrix';
import { Modifier, ObjectTransform, SourcePath } from '../model/types';
import { flattenSource, sourceFromPaths } from './flatten';

type BooleanModifier = Extract<Modifier, { type: 'boolean' }>;

export function hasOpenSubpath(source: SourcePath): boolean {
  return source.subpaths.some((subpath) => !subpath.closed);
}

export function placeOperand(
  owner: ObjectTransform,
  operand: ObjectTransform,
  source: SourcePath,
): SourcePath | null {
  const inverse = invertMatrix(matrixFromTransform(owner));
  if (!inverse) {
    return null;
  }
  return transformSource(source, multiplyMatrix(inverse, matrixFromTransform(operand)));
}

export function clipBoolean(
  owner: SourcePath,
  operand: SourcePath,
  modifier: BooleanModifier,
): SourcePath | null {
  const subject = closedRings(owner);
  const clip = closedRings(operand);
  try {
    const result =
      modifier.operation === 'union'
        ? union(subject, clip, FillRule.NonZero)
        : modifier.operation === 'intersect'
          ? intersect(subject, clip, FillRule.NonZero)
          : difference(subject, clip, FillRule.NonZero);
    return sourceFromPaths(result, modifier.id);
  } catch {
    return null;
  }
}

function closedRings(source: SourcePath) {
  return flattenSource(source)
    .filter((path) => path.closed && path.points.length >= 3)
    .map((path) => path.points);
}
