import { addPath } from '@vector-editor/modules/document-edits';
import { SessionSlice } from '@vector-editor/modules/types';

export function applyAddPath(state: SessionSlice, layerId: string): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = addPath(state.document, layerId);
  if (!created) {
    return state;
  }
  return {
    ...state,
    document: created.document,
    selectedLayerId: layerId,
    selection: {
      ...state.selection,
      activeObjectId: created.objectId,
      selectedObjectIds: [created.objectId],
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
}
