import { SessionSlice } from '@vector-editor/modules/types';
import { sameIds } from './document-helpers';

export function withObjectSelection(
  state: SessionSlice,
  selectedObjectIds: readonly string[],
  activeObjectId: string | null,
  clearAnchors: boolean,
): SessionSlice {
  const selection = state.selection;
  const dropAnchors = clearAnchors || selection.activeObjectId !== activeObjectId;
  const selectedAnchorIds = dropAnchors ? [] : selection.selectedAnchorIds;
  const selectedSegmentIds = dropAnchors ? [] : selection.selectedSegmentIds;
  if (
    selection.activeObjectId === activeObjectId &&
    sameIds(selection.selectedObjectIds, selectedObjectIds) &&
    sameIds(selection.selectedAnchorIds, selectedAnchorIds) &&
    sameIds(selection.selectedSegmentIds, selectedSegmentIds)
  ) {
    return state;
  }
  return {
    ...state,
    selection: {
      ...selection,
      activeObjectId,
      selectedObjectIds,
      selectedAnchorIds,
      selectedSegmentIds,
    },
  };
}
