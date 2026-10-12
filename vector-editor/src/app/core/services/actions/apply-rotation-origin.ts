import { Command } from '@vector-editor/commands';
import { isInteractionLocked } from '@vector-editor/modules/paint-order';
import { rotationOriginDocument, transformWithRotationOrigin } from '@vector-editor/modules/transform';
import { SessionSlice } from '@vector-editor/modules/types';
import { mapObjects } from './document-helpers';

export function applyRotationOrigin(state: SessionSlice, command: Extract<Command, { type: 'object.setRotationOrigin' }>): SessionSlice {
  const current = state.document;
  if (!current) {
    return state;
  }
  const document = mapObjects(current, command.ids, (object) => {
    if (isInteractionLocked(current, object)) {
      return object;
    }
    const present = rotationOriginDocument(object.transform);
    const point = {
      x: command.x ?? present.x,
      y: command.y ?? present.y,
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return object;
    }
    const next = transformWithRotationOrigin(object.transform, point);
    return next ? { ...object, transform: next } : object;
  });
  return document === state.document ? state : new SessionSlice({ ...state, document });
}
