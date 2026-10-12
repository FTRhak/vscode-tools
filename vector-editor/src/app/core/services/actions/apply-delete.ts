import { Command } from '@vector-editor/commands';
import { deleteObjects } from '@vector-editor/modules/delete-objects';
import { SessionSlice } from '@vector-editor/modules/types';
import { withoutRemovedObjects } from './state-helpers';

export function applyDelete(state: SessionSlice, command: Extract<Command, { type: 'object.delete' }>): SessionSlice {
  if (!state.document || command.ids.length === 0) {
    return state;
  }
  const result = deleteObjects(state.document, command.ids);
  if (!result) {
    return state;
  }
  return withoutRemovedObjects(state, result.document, result.removedIds);
}
