import { SessionSlice } from "@vector-editor/modules/types";

export function applyEditSelectionKind(state: SessionSlice, kind: SessionSlice['selection']['editSelectionKind']): SessionSlice {
    if (state.selection.editSelectionKind === kind) {
        return state;
    }
    return {
        ...state,
        selection: { ...state.selection, editSelectionKind: kind },
    };
}