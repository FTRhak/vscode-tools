import { Modifier, SourcePath, Subpath, VectorObject } from '../model/types';
import { applyArray } from './array';
import { applyMirror } from './mirror';

export interface EvaluatedGeometry {
  readonly objectId: string;
  readonly subpaths: readonly Subpath[];
  readonly diagnostics: readonly string[];
}

export interface EvaluatedSource {
  readonly source: SourcePath;
  readonly diagnostics: readonly string[];
}

export function evaluateObject(object: VectorObject): EvaluatedGeometry {
  const evaluated = evaluateSource(object.source, object.modifiers);
  return {
    objectId: object.id,
    subpaths: evaluated.source.subpaths,
    diagnostics: evaluated.diagnostics,
  };
}

export function evaluateSource(
  source: SourcePath,
  modifiers: readonly Modifier[],
): EvaluatedSource {
  const diagnostics: string[] = [];
  let current = source;

  for (const modifier of modifiers) {
    if (!modifier.enabled) {
      continue;
    }
    if (modifier.type === 'array') {
      current = applyArray(current, modifier);
    } else if (modifier.type === 'mirror') {
      current = applyMirror(current, modifier);
    } else if (modifier.type === 'bevel') {
      diagnostics.push('Bevel is not available yet.');
    } else {
      diagnostics.push('Boolean is not available yet.');
    }
  }

  return { source: current, diagnostics };
}
