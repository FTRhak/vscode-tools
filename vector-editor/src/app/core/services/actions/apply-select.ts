import { Command } from '@vector-editor/commands';
import { isEmptyPoint } from '@vector-editor/modules/object-empty-point';
import { SessionSlice } from '@vector-editor/modules/types';
import { uniqueKnown } from './document-helpers';
import { withObjectSelection } from './with-object-selection';

export function applySelect(state: SessionSlice, command: Extract<Command, { type: 'session.select' }>): SessionSlice {
  if (command.op === 'clear') {
    return withObjectSelection(state, [], null, true);
  }
  if (state.mode === 'edit' && command.target === 'object') {
    const allowed = command.ids.filter((id) => {
      const object = state.document?.objects.find((item) => item.id === id);
      return !object || !isEmptyPoint(object);
    });
    if (allowed.length === 0) {
      return state;
    }
    if (allowed.length !== command.ids.length) {
      command = { ...command, ids: allowed };
    }
  }

  const known = new Set(state.document?.objects.map((object) => object.id) ?? []);
  const ids = uniqueKnown(command.ids, known);
  if (command.op === 'replace') {
    return withObjectSelection(state, ids, ids.at(-1) ?? null, false);
  }

  if (command.op === 'add') {
    const current = state.selection.selectedObjectIds;
    const added = ids.filter((id) => !current.includes(id));
    const selected = [...current, ...added];
    const active = added.at(-1) ?? state.selection.activeObjectId;
    return withObjectSelection(state, selected, active, false);
  }

  const current = state.selection.selectedObjectIds;
  const remove = new Set<string>();
  const added: string[] = [];
  for (const id of ids) {
    if (current.includes(id)) {
      remove.add(id);
    } else if (!added.includes(id)) {
      added.push(id);
    }
  }
  const selected = [...current.filter((id) => !remove.has(id)), ...added];
  const active =
    added.at(-1) ?? (selected.includes(state.selection.activeObjectId ?? '') ? state.selection.activeObjectId : (selected.at(-1) ?? null));
  return withObjectSelection(state, selected, active, false);
}
