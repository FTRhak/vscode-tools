import { SessionSlice, VectorObject } from '@vector-editor/modules/types';

export function activeObject(state: SessionSlice): VectorObject | null {
  const id = state.selection.activeObjectId;
  if (!id || !state.document) {
    return null;
  }
  return state.document.objects.find((object) => object.id === id) ?? null;
}
