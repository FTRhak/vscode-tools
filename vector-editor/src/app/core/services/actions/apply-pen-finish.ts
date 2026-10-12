import { Command } from '@vector-editor/commands';
import { isInteractionLocked } from '@vector-editor/modules/paint-order';
import { finishPen } from '@vector-editor/modules/pen-path';
import { SessionSlice } from '@vector-editor/modules/types';
import { mapObjects } from './document-helpers';

export function applyPenFinish(state: SessionSlice, command: Extract<Command, { type: 'pen.finish' }>): SessionSlice {
  const cleared = state.penObjectId === null ? state : { ...state, penObjectId: null };
  if (!command.closed || !state.document) {
    return cleared;
  }
  const object = state.document.objects.find((item) => item.id === command.objectId);
  if (!object || isInteractionLocked(state.document, object)) {
    return cleared;
  }
  const source = finishPen(object.source, true);
  if (source === object.source) {
    return cleared;
  }
  return {
    ...cleared,
    document: mapObjects(state.document, [command.objectId], (item) => ({ ...item, source })),
  };
}
