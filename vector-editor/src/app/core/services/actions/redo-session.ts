import { SessionSlice } from "@vector-editor/modules/types";
import { reconcileSelectedLayer } from "./document-helpers";
import { reconcilePen } from "./state-helpers";

export function redoSession(state: SessionSlice): SessionSlice {
  const index = state.history.index + 1;
  const entry = state.history.entries[index];
  if (!entry) {
    return state;
  }
  return reconcileSelectedLayer(
    reconcilePen({
      ...state,
      document: entry.after.document,
      mode: entry.after.mode,
      selection: entry.after.selection,
      history: { entries: state.history.entries, index },
    }),
  );
}