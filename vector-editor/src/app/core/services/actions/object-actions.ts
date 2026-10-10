import { Command } from "@vector-editor/commands";
import { deleteLayer, deleteObjects } from "@vector-editor/modules/delete-objects";
import { addLayer, addPath } from "@vector-editor/modules/document-edits";
import { duplicateObjects } from "@vector-editor/modules/duplicate-objects";
import { expandTrace } from "@vector-editor/modules/expand-trace";
import { alignObjects } from "@vector-editor/modules/feature-align-objects";
import { identityTransform, matrixFromTransform, transformSource } from "@vector-editor/modules/io";
import { applyAllModifiers, applyModifier } from "@vector-editor/modules/modifier-edits/modifier-edits";
import { addEmptyPoint } from "@vector-editor/modules/object-empty-point";
import { addImage, isImage } from "@vector-editor/modules/object-image";
import { isInteractionLocked } from "@vector-editor/modules/paint-order";
import { addPenPoint, beginPenObject, finishPen, setPenHandles } from "@vector-editor/modules/pen-path";
import { addShape } from "@vector-editor/modules/shapes/shapes";
import { rotationOriginDocument, transformWithRotationOrigin } from "@vector-editor/modules/transform";
import { ObjectTransform, SessionSlice, VectorObject } from "@vector-editor/modules/types";
import { applyDocument, mapObjects } from "./document-helpers";
import { replaceSource } from "./replace-source";
import { penSelection, withFlags, withTransform, withoutRemovedObjects } from "./state-helpers";

export function applyTranslate(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.translate' }>,
): SessionSlice {
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

export function applyTransform(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.setTransform' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) =>
    withTransform(object, command.transform),
  );
  return document === state.document ? state : { ...state, document };
}

export function applyRotationOrigin(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.setRotationOrigin' }>,
): SessionSlice {
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

export function applyBakedTransform(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.applyTransform' }>,
): SessionSlice {
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

export function applyFlags(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.setFlags' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) => withFlags(object, command));
  return document === state.document ? state : { ...state, document };
}

export function applyDuplicate(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.duplicate' }>,
): SessionSlice {
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

export function applyAlign(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.align' }>,
): SessionSlice {
  const aligned = applyDocument(state, (document) =>
    alignObjects(document, command.ids, command.edge, command.to),
  );
  if (!command.applyTransform) {
    return aligned;
  }
  return command.ids.reduce(
    (next, id) => applyBakedTransform(next, { type: 'object.applyTransform', id }),
    aligned,
  );
}

export function applyDelete(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.delete' }>,
): SessionSlice {
  if (!state.document || command.ids.length === 0) {
    return state;
  }
  const result = deleteObjects(state.document, command.ids);
  if (!result) {
    return state;
  }
  return withoutRemovedObjects(state, result.document, result.removedIds);
}

export function applyDeleteLayer(
  state: SessionSlice,
  command: Extract<Command, { type: 'layer.delete' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const result = deleteLayer(state.document, command.id);
  if (!result) {
    return state;
  }
  return withoutRemovedObjects(state, result.document, result.removedIds);
}

export function applyPenBegin(
  state: SessionSlice,
  command: Extract<Command, { type: 'pen.begin' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = beginPenObject(
    state.document,
    command.position,
    state.selectedLayerId ?? undefined,
  );
  if (!created) {
    return state;
  }
  return {
    ...state,
    mode: 'edit',
    document: created.document,
    penObjectId: created.objectId,
    selection: penSelection(state.selection, created.objectId, created.anchorId, true),
  };
}

export function applyPenAddPoint(
  state: SessionSlice,
  command: Extract<Command, { type: 'pen.addPoint' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const object = state.document.objects.find((item) => item.id === command.objectId);
  if (!object || isInteractionLocked(state.document, object)) {
    return state;
  }
  const added = addPenPoint(object.source, command.position);
  if (!added) {
    return state;
  }
  return {
    ...state,
    document: mapObjects(state.document, [command.objectId], (item) => ({
      ...item,
      source: added.source,
    })),
    penObjectId: command.objectId,
    selection: penSelection(state.selection, command.objectId, added.anchorId, false),
  };
}

export function applyPenSetHandles(
  state: SessionSlice,
  command: Extract<Command, { type: 'pen.setHandles' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  return replaceSource(state, command.objectId, (source) =>
    setPenHandles(source, command.anchorId, command.handleOut, command.breakLink),
  );
}

export function applyPenFinish(
  state: SessionSlice,
  command: Extract<Command, { type: 'pen.finish' }>,
): SessionSlice {
  const cleared = state.penObjectId === null ? state : { ...state, penObjectId: null };
  if (!command.closed || !state.document) {
    return cleared;
  }
  const object = state.document.objects.find((item) => item.id === command.objectId);
  if (!object || isInteractionLocked(state.document, object)) {
    return cleared;
  }
  const source = finishPen(object.source, true);
  if (source === object.source) {
    return cleared;
  }
  return {
    ...cleared,
    document: mapObjects(state.document, [command.objectId], (item) => ({ ...item, source })),
  };
}

export function applyObjectChange(
  state: SessionSlice,
  objectId: string,
  update: (object: VectorObject) => VectorObject,
): SessionSlice {
  return applyDocument(state, (document) => mapObjects(document, [objectId], update));
}

export function applyModifierCommand(
  state: SessionSlice,
  objectId: string,
  modifierId?: string,
): SessionSlice {
  const document = state.document;
  if (!document) {
    return state;
  }
  const expanded = expandTrace(document, objectId, modifierId);
  if (expanded) {
    if (expanded.document === document) {
      return state;
    }
    return {
      ...state,
      document: expanded.document,
      selection: {
        ...state.selection,
        activeObjectId: expanded.newIds.at(-1) ?? null,
        selectedObjectIds: expanded.newIds,
        selectedAnchorIds: [],
        selectedSegmentIds: [],
      },
    };
  }
  if (modifierId === undefined) {
    return applyBakedModifier(state, objectId, (object) => applyAllModifiers(object, document.objects));
  }
  return applyBakedModifier(state, objectId, (object) =>
    applyModifier(object, modifierId, document.objects),
  );
}

export function applyBakedModifier(
  state: SessionSlice,
  objectId: string,
  update: (object: VectorObject) => VectorObject,
): SessionSlice {
  const next = applyObjectChange(state, objectId, update);
  if (next === state || next.selection.activeObjectId !== objectId) {
    return next;
  }
  if (
    next.selection.selectedAnchorIds.length === 0 &&
    next.selection.selectedSegmentIds.length === 0
  ) {
    return next;
  }
  return {
    ...next,
    selection: {
      ...next.selection,
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
}

export function applySelectLayer(state: SessionSlice, id: string): SessionSlice {
  if (state.selectedLayerId === id) {
    return state;
  }
  if (!state.document?.layers.some((layer) => layer.id === id)) {
    return state;
  }
  return { ...state, selectedLayerId: id };
}

export function applyAddLayer(state: SessionSlice): SessionSlice {
  if (!state.document) {
    return state;
  }
  const previousIds = new Set(state.document.layers.map((layer) => layer.id));
  const document = addLayer(state.document);
  const added = document.layers.find((layer) => !previousIds.has(layer.id));
  if (!added) {
    return state;
  }
  return { ...state, document, selectedLayerId: added.id };
}

export function applyPointAdd(
  state: SessionSlice,
  command: Extract<Command, { type: 'point.add' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = addEmptyPoint(
    state.document,
    command.position,
    state.selectedLayerId ?? undefined,
  );
  if (!created) {
    return state;
  }
  return {
    ...state,
    mode: 'object',
    document: created.document,
    selection: {
      ...state.selection,
      activeObjectId: created.objectId,
      selectedObjectIds: [created.objectId],
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
}

export function applyShapeAdd(
  state: SessionSlice,
  command: Extract<Command, { type: 'shape.add' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = addShape(
    state.document,
    command.name,
    command.source,
    state.selectedLayerId ?? undefined,
  );
  if (!created) {
    return state;
  }
  return {
    ...state,
    mode: 'object',
    document: created.document,
    selection: {
      ...state.selection,
      activeObjectId: created.objectId,
      selectedObjectIds: [created.objectId],
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
}

export function applyImageAdd(
  state: SessionSlice,
  command: Extract<Command, { type: 'image.add' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const created = addImage(
    state.document,
    {
      name: command.name,
      placement: command.placement,
      fileName: command.fileName,
      mime: command.mime,
      dataUrl: command.dataUrl,
      pixelWidth: command.pixelWidth,
      pixelHeight: command.pixelHeight,
      x: command.x,
      y: command.y,
      width: command.width,
      height: command.height,
      preserveAspectRatio: command.preserveAspectRatio,
    },
    state.selectedLayerId ?? undefined,
  );
  if (!created) {
    return state;
  }
  return {
    ...state,
    mode: 'object',
    document: created.document,
    selection: {
      ...state.selection,
      activeObjectId: created.objectId,
      selectedObjectIds: [created.objectId],
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
}

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

