import { Command } from "@vector-editor/commands";
import { beginPenObject } from "@vector-editor/modules/pen-path";
import { SessionSlice } from "@vector-editor/modules/types";
import { penSelection } from "./state-helpers";

export function applyPenBegin(state: SessionSlice, command: Extract<Command, { type: 'pen.begin' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = beginPenObject(state.document, command.position, state.selectedLayerId ?? undefined);
  if (!created) {
    return state;
  }
  return new SessionSlice({
    ...state,
    mode: 'edit',
    document: created.document,
    penObjectId: created.objectId,
    selection: penSelection(state.selection, created.objectId, created.anchorId, true),
  });
}
