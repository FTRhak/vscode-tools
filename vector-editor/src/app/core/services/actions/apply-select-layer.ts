import { SessionSlice } from "@vector-editor/modules/types";

export function applySelectLayer(state: SessionSlice, id: string): SessionSlice {
  if (state.selectedLayerId === id) {
    return state;
  }
  if (!state.document?.layers.some((layer) => layer.id === id)) {
    return state;
  }
  return new SessionSlice({ ...state, selectedLayerId: id });
}

