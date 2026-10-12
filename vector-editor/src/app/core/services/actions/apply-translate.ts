import { Command } from "@vector-editor/commands";
import { isInteractionLocked } from "@vector-editor/modules/paint-order";
import { SessionSlice } from "@vector-editor/modules/types";
import { mapObjects } from "./document-helpers";

export function applyTranslate(state: SessionSlice, command: Extract<Command, { type: 'object.translate' }>): SessionSlice {
  const current = state.document;
  if (!current || !Number.isFinite(command.dx) || !Number.isFinite(command.dy)) {
    return state;
  }
  if (command.dx === 0 && command.dy === 0) {
    return state;
  }
  const document = mapObjects(current, command.ids, (object) => {
    if (isInteractionLocked(current, object)) {
      return object;
    }
    return {
      ...object,
      transform: {
        ...object.transform,
        x: object.transform.x + command.dx,
        y: object.transform.y + command.dy,
      },
    };
  });
  return document === state.document ? state : { ...state, document };
}


