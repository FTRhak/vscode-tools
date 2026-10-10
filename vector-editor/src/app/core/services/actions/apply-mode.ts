import { SessionSlice } from "@vector-editor/modules/types";
import { sameIds } from "./document-helpers";
import { withoutEmptySelection } from "./without-empty-selection";


export function applyMode(state: SessionSlice, mode: SessionSlice['mode']): SessionSlice {
  const cleared = mode === 'edit' ? withoutEmptySelection(state) : state.selection;
  const selection = {
    ...cleared,
    selectedAnchorIds: [] as readonly string[],
    selectedSegmentIds: [] as readonly string[],
  };
  const penObjectId = mode === 'edit' ? state.penObjectId : null;
  if (
    state.mode === mode &&
    penObjectId === state.penObjectId &&
    state.selection.activeObjectId === selection.activeObjectId &&
    sameIds(state.selection.selectedObjectIds, selection.selectedObjectIds) &&
    state.selection.selectedAnchorIds.length === 0 &&
    state.selection.selectedSegmentIds.length === 0
  ) {
    return state;
  }
  return {
    ...state,
    mode,
    penObjectId,
    selection,
  };
}