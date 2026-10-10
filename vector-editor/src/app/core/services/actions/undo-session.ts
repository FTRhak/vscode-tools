import { SessionSlice } from '@vector-editor/modules/types';
import { reconcileSelectedLayer } from './document-helpers';
import { reconcilePen } from './state-helpers';

export function undoSession(state: SessionSlice): SessionSlice {
  const entry = state.history.entries[state.history.index];
  if (!entry || state.history.index < 0) {
    return state;
  }
  return reconcileSelectedLayer(
    reconcilePen({
      ...state,
      document: entry.before.document,
      mode: entry.before.mode,
      selection: entry.before.selection,
      history: { entries: state.history.entries, index: state.history.index - 1 },
    }),
  );
}
