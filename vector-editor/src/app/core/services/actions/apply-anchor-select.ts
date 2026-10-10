import { Command } from "@vector-editor/commands";
import { SessionSlice } from "@vector-editor/modules/types";
import { activeObject } from "./active-object";
import { anchorIds } from "./anchor-ids";
import { uniqueKnown } from "./document-helpers";
import { withAnchorSelection } from "./with-anchor-selection";

export function applyAnchorSelect(
  state: SessionSlice,
  command: Extract<Command, { type: 'session.select' }>,
): SessionSlice {
  if (state.mode !== 'edit') {
    return state;
  }
  const object = activeObject(state);
  if (!object) {
    return state;
  }
  if (command.op === 'clear') {
    return withAnchorSelection(state, []);
  }
  const known = anchorIds(object);
  const ids = uniqueKnown(command.ids, known);
  if (command.op === 'replace') {
    return withAnchorSelection(state, ids);
  }
  if (command.op === 'add') {
    const current = state.selection.selectedAnchorIds;
    const added = ids.filter((id) => !current.includes(id));
    return withAnchorSelection(state, [...current, ...added]);
  }
  const current = state.selection.selectedAnchorIds;
  const remove = new Set<string>();
  const added: string[] = [];
  for (const id of ids) {
    if (current.includes(id)) {
      remove.add(id);
    } else if (!added.includes(id)) {
      added.push(id);
    }
  }
  return withAnchorSelection(state, [...current.filter((id) => !remove.has(id)), ...added]);
}