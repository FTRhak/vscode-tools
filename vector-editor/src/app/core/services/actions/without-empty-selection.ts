import { isEmptyPoint } from "@vector-editor/modules/object-empty-point";
import { SessionSlice } from "@vector-editor/modules/types";

export function withoutEmptySelection(state: SessionSlice): SessionSlice['selection'] {
  const document = state.document;
  if (!document) {
    return state.selection;
  }
  const empty = new Set(
    document.objects.filter((object) => isEmptyPoint(object)).map((object) => object.id),
  );
  if (empty.size === 0) {
    return state.selection;
  }
  const selectedObjectIds = state.selection.selectedObjectIds.filter((id) => !empty.has(id));
  const activeKept =
    state.selection.activeObjectId !== null && !empty.has(state.selection.activeObjectId);
  return {
    ...state.selection,
    selectedObjectIds,
    activeObjectId: activeKept
      ? state.selection.activeObjectId
      : (selectedObjectIds.at(-1) ?? null),
  };
}