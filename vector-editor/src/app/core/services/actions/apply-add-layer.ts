import { addLayer } from "@vector-editor/modules/document-edits";
import { SessionSlice } from "@vector-editor/modules/types";

export function applyAddLayer(state: SessionSlice): SessionSlice {
  if (!state.document) {
    return state;
  }
  const previousIds = new Set(state.document.layers.map((layer) => layer.id));
  const document = addLayer(state.document);
  const added = document.layers.find((layer) => !previousIds.has(layer.id));
  if (!added) {
    return state;
  }
  return new SessionSlice({ ...state, document, selectedLayerId: added.id });
}

