import { layersFrontToBack } from '@vector-editor/modules/paint-order';
import { Document, SessionSlice, VectorObject } from '@vector-editor/modules/types';

export function applyDocument(state: SessionSlice, update: (document: Document) => Document): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = update(state.document);
  return document === state.document ? state : { ...state, document };
}

export function mapObjects(document: Document, ids: readonly string[], update: (object: VectorObject) => VectorObject): Document {
  if (ids.length === 0) {
    return document;
  }
  const wanted = new Set(ids);
  let changed = false;
  const objects = document.objects.map((object) => {
    if (!wanted.has(object.id)) {
      return object;
    }
    const next = update(object);
    if (next !== object) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...document, objects } : document;
}

export function uniqueKnown(ids: readonly string[], known: ReadonlySet<string>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function defaultLayerId(document: Document): string | null {
  return layersFrontToBack(document)[0]?.id ?? null;
}

export function reconcileSelectedLayer(state: SessionSlice): SessionSlice {
  const document = state.document;
  if (!document) {
    return state.selectedLayerId === null ? state : { ...state, selectedLayerId: null };
  }
  if (document.layers.some((layer) => layer.id === state.selectedLayerId)) {
    return state;
  }
  const fallback = defaultLayerId(document);
  return state.selectedLayerId === fallback ? state : { ...state, selectedLayerId: fallback };
}
