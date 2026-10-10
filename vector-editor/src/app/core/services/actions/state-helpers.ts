import { SelectionState } from '../../../commands/models/history';
import { SessionSlice, VectorObject, ObjectTransform } from '@vector-editor/modules/types';

export function withTransform(object: VectorObject, patch: Partial<ObjectTransform>): VectorObject {
  const transform = { ...object.transform };
  let changed = false;
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'originX', 'originY'] as const) {
    const value = patch[key];
    if (value !== undefined && value !== transform[key]) {
      transform[key] = value;
      changed = true;
    }
  }
  return changed ? { ...object, transform } : object;
}

export function withFlags(
  object: VectorObject,
  patch: { readonly name?: string; readonly visible?: boolean; readonly locked?: boolean },
): VectorObject {
  let next = object;
  if (patch.name !== undefined && patch.name !== object.name) {
    next = { ...next, name: patch.name };
  }
  if (patch.visible !== undefined && patch.visible !== object.visible) {
    next = { ...next, visible: patch.visible };
  }
  if (patch.locked !== undefined && patch.locked !== object.locked) {
    next = { ...next, locked: patch.locked };
  }
  return next;
}

export function withoutRemovedObjects(
  state: SessionSlice,
  document: SessionSlice['document'],
  removedIds: readonly string[],
): SessionSlice {
  if (!document) {
    return state;
  }
  const removed = new Set(removedIds);
  const selectedObjectIds = state.selection.selectedObjectIds.filter((id) => !removed.has(id));
  const activeKept = state.selection.activeObjectId !== null && !removed.has(state.selection.activeObjectId);
  return {
    ...state,
    document,
    penObjectId: state.penObjectId !== null && !removed.has(state.penObjectId) ? state.penObjectId : null,
    selection: {
      ...state.selection,
      activeObjectId: activeKept ? state.selection.activeObjectId : (selectedObjectIds.at(-1) ?? null),
      selectedObjectIds,
      selectedAnchorIds: activeKept ? state.selection.selectedAnchorIds : [],
      selectedSegmentIds: activeKept ? state.selection.selectedSegmentIds : [],
    },
  };
}

export function penSelection(selection: SelectionState, objectId: string, anchorId: string, replaceObjects: boolean): SelectionState {
  const selectedObjectIds = replaceObjects || !selection.selectedObjectIds.includes(objectId) ? [objectId] : selection.selectedObjectIds;
  return {
    ...selection,
    activeObjectId: objectId,
    selectedObjectIds,
    selectedAnchorIds: [anchorId],
    selectedSegmentIds: [],
  };
}

export function reconcilePen(state: SessionSlice): SessionSlice {
  if (state.penObjectId === null) {
    return state;
  }
  if (state.tool !== 'pen' || state.mode !== 'edit' || !state.document) {
    return { ...state, penObjectId: null };
  }
  const object = state.document.objects.find((item) => item.id === state.penObjectId);
  const subpath = object?.source.subpaths.at(-1);
  if (!object || !subpath || subpath.closed) {
    return { ...state, penObjectId: null };
  }
  return state;
}
