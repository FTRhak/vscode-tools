import { Command } from "@vector-editor/commands";
import { deleteAnchors } from "@vector-editor/modules/edit-path";
import { isImage } from "@vector-editor/modules/object-image";
import { isInteractionLocked } from "@vector-editor/modules/paint-order";
import { SessionSlice } from "@vector-editor/modules/types";
import { mapObjects, sameIds } from "./document-helpers";

export function applyDeleteAnchors(
  state: SessionSlice,
  command: Extract<Command, { type: 'path.deleteAnchors' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const object = state.document.objects.find((item) => item.id === command.objectId);
  if (!object || isImage(object) || isInteractionLocked(state.document, object)) {
    return state;
  }
  const source = deleteAnchors(object.source, command.anchorIds);
  if (source === object.source) {
    return state;
  }
  const document = mapObjects(state.document, [command.objectId], (item) => ({ ...item, source }));
  const removed = new Set(command.anchorIds);
  const selectedAnchorIds = state.selection.selectedAnchorIds.filter((id) => !removed.has(id));
  const selection = sameIds(state.selection.selectedAnchorIds, selectedAnchorIds)
    ? state.selection
    : { ...state.selection, selectedAnchorIds };
  return { ...state, document, selection };
}