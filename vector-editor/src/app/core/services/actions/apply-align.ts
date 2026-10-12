import { Command } from "@vector-editor/commands";
import { alignObjects } from "@vector-editor/modules/feature-align-objects";
import { SessionSlice } from "@vector-editor/modules/types";
import { applyBakedTransform } from "./apply-baked-transform";
import { applyDocument } from "./document-helpers";

export function applyAlign(state: SessionSlice, command: Extract<Command, { type: 'object.align' }>): SessionSlice {
  const aligned = applyDocument(state, (document) => alignObjects(document, command.ids, command.edge, command.to));
  if (!command.applyTransform) {
    return aligned;
  }
  return command.ids.reduce((next, id) => applyBakedTransform(next, { type: 'object.applyTransform', id }), aligned);
}

