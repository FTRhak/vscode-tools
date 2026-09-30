import { isInteractionLocked } from './paint-order';
import { Document, Modifier, VectorObject } from './types';

export function deletableObjectIds(document: Document, ids: readonly string[]): readonly string[] {
  const byId = new Map(document.objects.map((object) => [object.id, object]));
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    const object = byId.get(id);
    if (!object || isInteractionLocked(document, object)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function deleteObjects(
  document: Document,
  ids: readonly string[],
): { readonly document: Document; readonly removedIds: readonly string[] } | null {
  const removedIds = deletableObjectIds(document, ids);
  if (removedIds.length === 0) {
    return null;
  }
  const removed = new Set(removedIds);
  return {
    document: {
      ...document,
      objects: document.objects
        .filter((object) => !removed.has(object.id))
        .map((object) => withoutDeletedOperands(object, removed)),
    },
    removedIds,
  };
}

function withoutDeletedOperands(object: VectorObject, removed: ReadonlySet<string>): VectorObject {
  let changed = false;
  const modifiers = object.modifiers.filter((modifier) => {
    if (pointsAtRemoved(modifier, removed)) {
      changed = true;
      return false;
    }
    return true;
  });
  return changed ? { ...object, modifiers } : object;
}

function pointsAtRemoved(modifier: Modifier, removed: ReadonlySet<string>): boolean {
  return modifier.type === 'boolean' && removed.has(modifier.operandId);
}
