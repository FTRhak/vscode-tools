import { Command } from "@vector-editor/commands";
import { isInteractionLocked } from "@vector-editor/modules/paint-order";
import { addPenPoint } from "@vector-editor/modules/pen-path";
import { SessionSlice } from "@vector-editor/modules/types";
import { mapObjects } from "./document-helpers";
import { penSelection } from "./state-helpers";

export function applyPenAddPoint(state: SessionSlice, command: Extract<Command, { type: 'pen.addPoint' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const object = state.document.objects.find((item) => item.id === command.objectId);
  if (!object || isInteractionLocked(state.document, object)) {
    return state;
  }
  const added = addPenPoint(object.source, command.position);
  if (!added) {
    return state;
  }
  return {
    ...state,
    document: mapObjects(state.document, [command.objectId], (item) => ({
      ...item,
      source: added.source,
    })),
    penObjectId: command.objectId,
    selection: penSelection(state.selection, command.objectId, added.anchorId, false),
  };
}