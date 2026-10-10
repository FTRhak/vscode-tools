import { EditorTool } from "@vector-editor/commands";
import { SessionSlice } from "@vector-editor/modules/types";

export function applyTool(state: SessionSlice, tool: EditorTool): SessionSlice {
  const penObjectId = tool === 'pen' ? state.penObjectId : null;
  if (state.tool === tool && state.penObjectId === penObjectId) {
    return state;
  }
  return { ...state, tool, penObjectId };
}