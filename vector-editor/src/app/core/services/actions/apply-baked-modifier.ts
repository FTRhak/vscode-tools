import { SessionSlice, VectorObject } from "@vector-editor/modules/types";
import { applyObjectChange } from "./apply-object-change";


export function applyBakedModifier(state: SessionSlice, objectId: string, update: (object: VectorObject) => VectorObject): SessionSlice {
  const next = applyObjectChange(state, objectId, update);
  if (next === state || next.selection.activeObjectId !== objectId) {
    return next;
  }
  if (next.selection.selectedAnchorIds.length === 0 && next.selection.selectedSegmentIds.length === 0) {
    return next;
  }
  return new SessionSlice( {
    ...next,
    selection: {
      ...next.selection,
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  });
}
