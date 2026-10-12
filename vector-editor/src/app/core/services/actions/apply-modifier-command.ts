import { expandTrace } from '@vector-editor/modules/expand-trace';
import { applyAllModifiers, applyModifier } from '@vector-editor/modules/modifier-edits';
import { SessionSlice } from '@vector-editor/modules/types';
import { applyBakedModifier } from './apply-baked-modifier';

export function applyModifierCommand(state: SessionSlice, objectId: string, modifierId?: string): SessionSlice {
  const document = state.document;
  if (!document) {
    return state;
  }
  const expanded = expandTrace(document, objectId, modifierId);
  if (expanded) {
    if (expanded.document === document) {
      return state;
    }
    return new SessionSlice({
      ...state,
      document: expanded.document,
      selection: {
        ...state.selection,
        activeObjectId: expanded.newIds.at(-1) ?? null,
        selectedObjectIds: expanded.newIds,
        selectedAnchorIds: [],
        selectedSegmentIds: [],
      },
    });
  }
  if (modifierId === undefined) {
    return applyBakedModifier(state, objectId, (object) => applyAllModifiers(object, document.objects));
  }
  return applyBakedModifier(state, objectId, (object) => applyModifier(object, modifierId, document.objects));
}
