import { SessionSnapshot } from "@vector-editor/commands";
import { SessionSlice } from "@vector-editor/modules/types";

export function snapshotOf(state: SessionSlice): SessionSnapshot {
  return {
    document: state.document,
    mode: state.mode,
    selection: state.selection,
  };
}