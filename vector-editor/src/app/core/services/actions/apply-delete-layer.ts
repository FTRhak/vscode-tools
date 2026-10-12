import { Command } from '@vector-editor/commands';
import { deleteLayer } from '@vector-editor/modules/delete-objects';
import { SessionSlice } from '@vector-editor/modules/types';
import { withoutRemovedObjects } from './state-helpers';

export function applyDeleteLayer(state: SessionSlice, command: Extract<Command, { type: 'layer.delete' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const result = deleteLayer(state.document, command.id);
  if (!result) {
    return state;
  }
  return withoutRemovedObjects(state, result.document, result.removedIds);
}
