import { Command } from "@vector-editor/commands";
import { addImage } from "@vector-editor/modules/object-image";
import { SessionSlice } from "@vector-editor/modules/types";

export function applyImageAdd(state: SessionSlice, command: Extract<Command, { type: 'image.add' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = addImage(
    state.document,
    {
      name: command.name,
      placement: command.placement,
      fileName: command.fileName,
      mime: command.mime,
      dataUrl: command.dataUrl,
      pixelWidth: command.pixelWidth,
      pixelHeight: command.pixelHeight,
      x: command.x,
      y: command.y,
      width: command.width,
      height: command.height,
      preserveAspectRatio: command.preserveAspectRatio,
    },
    state.selectedLayerId ?? undefined,
  );
  if (!created) {
    return state;
  }

  return new SessionSlice({
    ...state,
    mode: 'object',
    document: created.document,
    selection: {
      ...state.selection,
      activeObjectId: created.objectId,
      selectedObjectIds: [created.objectId],
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  });
}
