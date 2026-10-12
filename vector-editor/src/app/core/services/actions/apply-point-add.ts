import { Command } from '@vector-editor/commands';
import { addEmptyPoint } from '@vector-editor/modules/object-empty-point';
import { SessionSlice } from '@vector-editor/modules/types';

export function applyPointAdd(state: SessionSlice, command: Extract<Command, { type: 'point.add' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = addEmptyPoint(state.document, command.position, state.selectedLayerId ?? undefined);
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
