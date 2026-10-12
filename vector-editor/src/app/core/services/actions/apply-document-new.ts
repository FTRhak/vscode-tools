import { Command, emptySelection } from '@vector-editor/commands';
import { createNewDocument } from '@vector-editor/modules/create-document';
import { SessionSlice } from '@vector-editor/modules/types';
import { defaultLayerId } from './document-helpers';

export function applyDocumentNew(state: SessionSlice, command: Extract<Command, { type: 'document.new' }>): SessionSlice {
  const document = createNewDocument({ width: command.width, height: command.height });

  return new SessionSlice({
    ...state,
    document,
    selection: emptySelection,
    penObjectId: null,
    selectedLayerId: defaultLayerId(document),
  });
}
