import { ImagePlacement, SessionSlice } from "@vector-editor/modules/types";

export function applyImagePlacement(state: SessionSlice, placement: ImagePlacement): SessionSlice {
  return state.imagePlacement === placement ? state : { ...state, imagePlacement: placement };
}