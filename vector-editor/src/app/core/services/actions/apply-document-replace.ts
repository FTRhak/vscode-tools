import { Command, emptySelection } from '@vector-editor/commands';
import { SessionSlice } from '@vector-editor/modules/types';
import { defaultLayerId } from './document-helpers';

export function applyDocumentReplace(state: SessionSlice, command: Extract<Command, { type: 'document.replace' }>): SessionSlice {
  return new SessionSlice({
    ...state,
    document: command.document,
    mode: 'object',
    selection: emptySelection,
    penObjectId: null,
    selectedLayerId: defaultLayerId(command.document),
  });
}
