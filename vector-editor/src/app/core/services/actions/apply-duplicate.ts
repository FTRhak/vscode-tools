import { Command } from '@vector-editor/commands';
import { duplicateObjects } from '@vector-editor/modules/duplicate-objects';
import { SessionSlice } from '@vector-editor/modules/types';

export function applyDuplicate(state: SessionSlice, command: Extract<Command, { type: 'object.duplicate' }>): SessionSlice {
  if (!state.document || command.ids.length === 0) {
    return state;
  }
  const result = duplicateObjects(state.document, command.ids);
  if (!result) {
    return state;
  }
  return new SessionSlice({
    ...state,
    document: result.document,
    selection: {
      ...state.selection,
      activeObjectId: result.newIds.at(-1) ?? null,
      selectedObjectIds: result.newIds,
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  });
}
