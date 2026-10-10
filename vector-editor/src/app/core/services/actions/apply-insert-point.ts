import { Command } from "@vector-editor/commands";
import { insertPoint } from "@vector-editor/modules/edit-path";
import { isImage } from "@vector-editor/modules/object-image";
import { isInteractionLocked } from "@vector-editor/modules/paint-order";
import { SessionSlice } from "@vector-editor/modules/types";
import { mapObjects } from "./document-helpers";

export function applyInsertPoint(
  state: SessionSlice,
  command: Extract<Command, { type: 'path.insertPoint' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const object = state.document.objects.find((item) => item.id === command.objectId);
  if (!object || isImage(object) || isInteractionLocked(state.document, object)) {
    return state;
  }
  const inserted = insertPoint(object.source, command.segmentId, command.t);
  if (!inserted) {
    return state;
  }
  const document = mapObjects(state.document, [command.objectId], (item) => ({
    ...item,
    source: inserted.source,
  }));
  const selection =
    state.selection.activeObjectId === command.objectId
      ? {
          ...state.selection,
          selectedAnchorIds: [inserted.anchorId],
          selectedSegmentIds: [],
        }
      : state.selection;
  return { ...state, document, selection };
}