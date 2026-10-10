import { SessionSlice } from "@vector-editor/modules/types";
import { sameIds } from "./document-helpers";

export function withAnchorSelection(
  state: SessionSlice,
  selectedAnchorIds: readonly string[],
): SessionSlice {
  if (sameIds(state.selection.selectedAnchorIds, selectedAnchorIds)) {
    return state;
  }
  return {
    ...state,
    selection: { ...state.selection, selectedAnchorIds },
  };
}