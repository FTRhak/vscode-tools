import { SessionSlice } from '@vector-editor/modules/types';
import { reconcileSelectedLayer } from './document-helpers';
import { reconcilePen } from './state-helpers';

export function jumpSession(state: SessionSlice, index: number): SessionSlice {
  const { entries } = state.history;
  if (!Number.isInteger(index) || index < -1 || index >= entries.length || index === state.history.index) {
    return state;
  }
  const snapshot = index === -1 ? entries[0]?.before : entries[index]?.after;
  if (!snapshot) {
    return state;
  }
  return reconcileSelectedLayer(
    reconcilePen({
      ...state,
      document: snapshot.document,
      mode: snapshot.mode,
      selection: snapshot.selection,
      history: { entries, index },
    }),
  );
}
