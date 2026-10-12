import { Command } from '@vector-editor/commands';
import { deleteLayer, deleteObjects } from '@vector-editor/modules/delete-objects';
import { duplicateObjects } from '@vector-editor/modules/duplicate-objects';
import { alignObjects } from '@vector-editor/modules/feature-align-objects';
import { identityTransform, matrixFromTransform, transformSource } from '@vector-editor/modules/io';
import { isImage } from '@vector-editor/modules/object-image';
import { isInteractionLocked } from '@vector-editor/modules/paint-order';
import { rotationOriginDocument, transformWithRotationOrigin } from '@vector-editor/modules/transform';
import { ObjectTransform, SessionSlice, VectorObject } from '@vector-editor/modules/types';
import { applyDocument, mapObjects } from './document-helpers';
import { withFlags, withTransform, withoutRemovedObjects } from './state-helpers';

export function applyTranslate(state: SessionSlice, command: Extract<Command, { type: 'object.translate' }>): SessionSlice {
  const current = state.document;
  if (!current || !Number.isFinite(command.dx) || !Number.isFinite(command.dy)) {
    return state;
  }
  if (command.dx === 0 && command.dy === 0) {
    return state;
  }
  const document = mapObjects(current, command.ids, (object) => {
    if (isInteractionLocked(current, object)) {
      return object;
    }
    return {
      ...object,
      transform: {
        ...object.transform,
        x: object.transform.x + command.dx,
        y: object.transform.y + command.dy,
      },
    };
  });
  return document === state.document ? state : { ...state, document };
}

export function applyTransform(state: SessionSlice, command: Extract<Command, { type: 'object.setTransform' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) => withTransform(object, command.transform));
  return document === state.document ? state : { ...state, document };
}

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
  return document === state.document ? state : { ...state, document };
}

export function applyBakedTransform(state: SessionSlice, command: Extract<Command, { type: 'object.applyTransform' }>): SessionSlice {
  const current = state.document;
  if (!current) {
    return state;
  }
  const document = mapObjects(current, [command.id], (object) => {
    if (isInteractionLocked(current, object) || isIdentityTransform(object.transform)) {
      return object;
    }
    if (isImage(object)) {
      return bakeImageScale(object);
    }
    return {
      ...object,
      source: transformSource(object.source, matrixFromTransform(object.transform)),
      transform: identityTransform,
    };
  });
  return document === current ? state : { ...state, document };
}

function bakeImageScale(object: VectorObject): VectorObject {
  const image = object.image;
  if (!image || (object.transform.scaleX === 1 && object.transform.scaleY === 1)) {
    return object;
  }
  const width = image.width * object.transform.scaleX;
  const height = image.height * object.transform.scaleY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return object;
  }
  return {
    ...object,
    image: { ...image, width, height },
    transform: { ...object.transform, scaleX: 1, scaleY: 1 },
  };
}

function isIdentityTransform(transform: ObjectTransform): boolean {
  return (
    transform.x === identityTransform.x &&
    transform.y === identityTransform.y &&
    transform.rotation === identityTransform.rotation &&
    transform.scaleX === identityTransform.scaleX &&
    transform.scaleY === identityTransform.scaleY &&
    transform.originX === identityTransform.originX &&
    transform.originY === identityTransform.originY
  );
}

export function applyFlags(state: SessionSlice, command: Extract<Command, { type: 'object.setFlags' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) => withFlags(object, command));
  return document === state.document ? state : { ...state, document };
}

export function applyDuplicate(state: SessionSlice, command: Extract<Command, { type: 'object.duplicate' }>): SessionSlice {
  if (!state.document || command.ids.length === 0) {
    return state;
  }
  const result = duplicateObjects(state.document, command.ids);
  if (!result) {
    return state;
  }
  return {
    ...state,
    document: result.document,
    selection: {
      ...state.selection,
      activeObjectId: result.newIds.at(-1) ?? null,
      selectedObjectIds: result.newIds,
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
}

export function applyAlign(state: SessionSlice, command: Extract<Command, { type: 'object.align' }>): SessionSlice {
  const aligned = applyDocument(state, (document) => alignObjects(document, command.ids, command.edge, command.to));
  if (!command.applyTransform) {
    return aligned;
  }
  return command.ids.reduce((next, id) => applyBakedTransform(next, { type: 'object.applyTransform', id }), aligned);
}

export function applyDelete(state: SessionSlice, command: Extract<Command, { type: 'object.delete' }>): SessionSlice {
  if (!state.document || command.ids.length === 0) {
    return state;
  }
  const result = deleteObjects(state.document, command.ids);
  if (!result) {
    return state;
  }
  return withoutRemovedObjects(state, result.document, result.removedIds);
}

export function applyDeleteLayer(state: SessionSlice, command: Extract<Command, { type: 'layer.delete' }>): SessionSlice {
  if (!state.document) {
    return state;
  }
  const result = deleteLayer(state.document, command.id);
  if (!result) {
    return state;
  }
  return withoutRemovedObjects(state, result.document, result.removedIds);
}




