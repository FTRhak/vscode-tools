import { Command } from '@vector-editor/commands';
import { SessionSlice } from '@vector-editor/modules/types';
import { historyLabel, recordHistory } from '../../../commands/models/history';
import { applySessionCommand } from './apply-session-command';
import { jumpSession } from './jump-session';
import { reconcileSelectedLayer } from './document-helpers';
import { sameSnapshot } from './same-snapshot';
import { snapshotOf } from './snapshot-of';
import { redoSession } from './redo-session';
import { undoSession } from './undo-session';

export function commitSession(state: SessionSlice, command: Command): SessionSlice {
  if (command.type === 'history.undo') {
    return undoSession(state);
  }
  if (command.type === 'history.redo') {
    return redoSession(state);
  }
  if (command.type === 'history.jump') {
    return jumpSession(state, command.index);
  }

  const next = reconcileSelectedLayer(applySessionCommand(state, command));
  const label = historyLabel(command);
  if (!label) {
    return next;
  }

  const before = snapshotOf(state);
  const after = snapshotOf(next);
  if (sameSnapshot(before, after)) {
    return next;
  }

  return {
    ...next,
    history: recordHistory(state.history, label, before, after, command),
  };
}
