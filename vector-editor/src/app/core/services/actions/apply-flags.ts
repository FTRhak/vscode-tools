import { Command } from "@vector-editor/commands";
import { SessionSlice } from "@vector-editor/modules/types";
import { mapObjects } from "./document-helpers";
import { withFlags } from "./state-helpers";

export function applyFlags(state: SessionSlice, command: Extract<Command, { type: 'object.setFlags' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) => withFlags(object, command));
  return document === state.document ? state : new SessionSlice({ ...state, document });
}

