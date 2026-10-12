import { Command } from "@vector-editor/commands";
import { SessionSlice } from "@vector-editor/modules/types";
import { mapObjects } from "./document-helpers";
import { withTransform } from "./state-helpers";

export function applyTransform(state: SessionSlice, command: Extract<Command, { type: 'object.setTransform' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) => withTransform(object, command.transform));
  return document === state.document ? state : new SessionSlice({ ...state, document });
}

