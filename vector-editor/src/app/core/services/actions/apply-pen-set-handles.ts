import { Command } from "@vector-editor/commands";
import { SessionSlice } from "@vector-editor/modules/types";
import { replaceSource } from "./replace-source";
import { setPenHandles } from "@vector-editor/modules/pen-path";

export function applyPenSetHandles(state: SessionSlice, command: Extract<Command, { type: 'pen.setHandles' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  return replaceSource(state, command.objectId, (source) => setPenHandles(source, command.anchorId, command.handleOut, command.breakLink));
}


