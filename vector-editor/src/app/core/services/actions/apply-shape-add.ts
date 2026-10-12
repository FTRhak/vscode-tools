import { Command } from '@vector-editor/commands';
import { addShape } from '@vector-editor/modules/shapes';
import { SessionSlice } from '@vector-editor/modules/types';

export function applyShapeAdd(state: SessionSlice, command: Extract<Command, { type: 'shape.add' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = addShape(state.document, command.name, command.source, state.selectedLayerId ?? undefined);
  if (!created) {
    return state;
  }
  return {
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
  };
}
