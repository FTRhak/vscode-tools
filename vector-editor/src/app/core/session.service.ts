import { computed, Service, signal } from '@angular/core';
import { Command, EditorMode, EditorTool } from '../commands/models/command';
import {
  emptyHistory,
  emptySelection,
  HistoryState,
  historyLabel,
  recordHistory,
  SelectionState,
  SessionSnapshot,
} from '../commands/models/history';
import { captureClipperHold, ClipperHold } from './eval/evaluate';
import { createNewDocument } from './model/create-document';
import {
  addLayer,
  addPath,
  addSwatch,
  applySwatch,
  reorderLayer,
  setObjectStyle,
  updateLayer,
} from './model/document-edits';
import { duplicateObjects } from './model/duplicate-objects';
import {
  deleteAnchors,
  setAnchorHandle,
  setAnchorPosition,
  translateAnchors,
} from './model/edit-path';
import {
  addModifier,
  applyAllModifiers,
  applyModifier,
  removeModifier,
  reorderModifier,
  updateModifier,
} from './model/modifier-edits';
import { isInteractionLocked, layersFrontToBack } from './model/paint-order';
import { addPenPoint, beginPenObject, finishPen, setPenHandles } from './model/pen-path';
import { Document, ObjectTransform, SourcePath, VectorObject, ViewportCamera } from './model/types';

export interface SessionSlice {
  readonly mode: EditorMode;
  readonly tool: EditorTool;
  readonly document: Document | null;
  readonly viewport: ViewportCamera;
  readonly selection: SelectionState;
  readonly history: HistoryState;
  readonly penObjectId: string | null;
  readonly selectedLayerId: string | null;
}

const initialSession: SessionSlice = {
  mode: 'object',
  tool: 'select',
  document: null,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  selection: emptySelection,
  history: emptyHistory,
  penObjectId: null,
  selectedLayerId: null,
};

type DocumentCommand = Exclude<
  Command,
  { type: 'history.undo' } | { type: 'history.redo' } | { type: 'history.jump' }
>;

export function applySessionCommand(state: SessionSlice, command: DocumentCommand): SessionSlice {
  switch (command.type) {
    case 'session.setMode':
      return applyMode(state, command.mode);
    case 'session.setTool':
      return applyTool(state, command.tool);
    case 'session.setEditSelectionKind':
      return applyEditSelectionKind(state, command.kind);
    case 'document.new': {
      const document = createNewDocument({ width: command.width, height: command.height });
      return {
        ...state,
        document,
        selection: emptySelection,
        penObjectId: null,
        selectedLayerId: defaultLayerId(document),
      };
    }
    case 'document.replace':
      return {
        ...state,
        document: command.document,
        mode: 'object',
        selection: emptySelection,
        penObjectId: null,
        selectedLayerId: defaultLayerId(command.document),
      };
    case 'session.setViewport':
      return {
        ...state,
        viewport: { panX: command.panX, panY: command.panY, zoom: command.zoom },
      };
    case 'session.select':
      return command.target === 'anchor'
        ? applyAnchorSelect(state, command)
        : applySelect(state, command);
    case 'session.selectLayer':
      return applySelectLayer(state, command.id);
    case 'path.translateAnchors':
      return replaceSource(state, command.objectId, (source) =>
        translateAnchors(source, command.anchorIds, command.dx, command.dy),
      );
    case 'path.setAnchor':
      return replaceSource(state, command.objectId, (source) =>
        setAnchorPosition(source, command.anchorIds, command.position),
      );
    case 'path.setHandle':
      return replaceSource(state, command.objectId, (source) =>
        setAnchorHandle(
          source,
          command.anchorIds,
          command.slot,
          command.position,
          command.breakLink,
        ),
      );
    case 'path.deleteAnchors':
      return applyDeleteAnchors(state, command);
    case 'object.translate':
      return applyTranslate(state, command);
    case 'object.setTransform':
      return applyTransform(state, command);
    case 'object.setFlags':
      return applyFlags(state, command);
    case 'object.duplicate':
      return applyDuplicate(state, command);
    case 'style.set':
      return applyDocument(state, (document) =>
        setObjectStyle(document, command.objectIds, {
          fill: command.fill,
          stroke: command.stroke,
          strokeWidth: command.strokeWidth,
        }),
      );
    case 'swatch.add':
      return applyDocument(state, (document) => addSwatch(document, command.name, command.color));
    case 'swatch.apply':
      return applyDocument(state, (document) =>
        applySwatch(document, command.swatchId, command.target, command.objectIds),
      );
    case 'layer.add':
      return applyAddLayer(state);
    case 'path.add':
      return applyAddPath(state, command.layerId);
    case 'layer.update':
      return applyDocument(state, (document) => updateLayer(document, command.id, command));
    case 'layer.reorder':
      return applyDocument(state, (document) => reorderLayer(document, command.id, command.index));
    case 'pen.begin':
      return applyPenBegin(state, command);
    case 'pen.addPoint':
      return applyPenAddPoint(state, command);
    case 'pen.setHandles':
      return applyPenSetHandles(state, command);
    case 'pen.finish':
      return applyPenFinish(state, command);
    case 'modifier.add':
      return applyObjectChange(state, command.objectId, (object) =>
        addModifier(object, command.kind, state.document?.objects ?? []),
      );
    case 'modifier.update':
      return applyObjectChange(state, command.objectId, (object) =>
        updateModifier(object, command.modifierId, command.patch),
      );
    case 'modifier.remove':
      return applyObjectChange(state, command.objectId, (object) =>
        removeModifier(object, command.modifierId),
      );
    case 'modifier.reorder':
      return applyObjectChange(state, command.objectId, (object) =>
        reorderModifier(object, command.modifierId, command.index),
      );
    case 'modifier.apply':
      return applyBakedModifier(state, command.objectId, (object) =>
        applyModifier(object, command.modifierId, state.document?.objects ?? []),
      );
    case 'modifier.applyAll':
      return applyBakedModifier(state, command.objectId, (object) =>
        applyAllModifiers(object, state.document?.objects ?? []),
      );
  }
}

export function commitSession(state: SessionSlice, command: Command): SessionSlice {
  if (command.type === 'history.undo') {
    return undoSession(state);
  }
  if (command.type === 'history.redo') {
    return redoSession(state);
  }
  if (command.type === 'history.jump') {
    return jumpSession(state, command.index);
  }

  const next = reconcileSelectedLayer(applySessionCommand(state, command));
  const label = historyLabel(command);
  if (!label) {
    return next;
  }

  const before = snapshotOf(state);
  const after = snapshotOf(next);
  if (sameSnapshot(before, after)) {
    return next;
  }

  return {
    ...next,
    history: recordHistory(state.history, label, before, after, command),
  };
}

@Service()
export class SessionService {
  private readonly state = signal<SessionSlice>(initialSession);
  private readonly clipperHoldState = signal<ClipperHold | null>(null);

  readonly mode = computed(() => this.state().mode);
  readonly tool = computed(() => this.state().tool);
  readonly document = computed(() => this.state().document);
  readonly viewport = computed(() => this.state().viewport);
  readonly activeObjectId = computed(() => this.state().selection.activeObjectId);
  readonly selectedObjectIds = computed(() => this.state().selection.selectedObjectIds);
  readonly editSelectionKind = computed(() => this.state().selection.editSelectionKind);
  readonly selectedAnchorIds = computed(() => this.state().selection.selectedAnchorIds);
  readonly selectedSegmentIds = computed(() => this.state().selection.selectedSegmentIds);
  readonly history = computed(() => this.state().history);
  readonly canUndo = computed(() => this.state().history.index >= 0);
  readonly canRedo = computed(
    () => this.state().history.index < this.state().history.entries.length - 1,
  );
  readonly penObjectId = computed(() => this.state().penObjectId);
  readonly selectedLayerId = computed(() => this.state().selectedLayerId);
  readonly clipperHold = this.clipperHoldState.asReadonly();

  apply(command: Command): void {
    this.state.update((current) => commitSession(current, command));
  }

  beginClipperHold(): void {
    if (this.clipperHoldState() !== null) {
      return;
    }
    const document = this.state().document;
    if (!document) {
      return;
    }
    this.clipperHoldState.set(captureClipperHold(document.objects));
  }

  endClipperHold(): void {
    if (this.clipperHoldState() === null) {
      return;
    }
    this.clipperHoldState.set(null);
  }
}

function snapshotOf(state: SessionSlice): SessionSnapshot {
  return {
    document: state.document,
    mode: state.mode,
    selection: state.selection,
  };
}

function sameSnapshot(before: SessionSnapshot, after: SessionSnapshot): boolean {
  return (
    before.document === after.document &&
    before.mode === after.mode &&
    before.selection === after.selection
  );
}

function undoSession(state: SessionSlice): SessionSlice {
  const entry = state.history.entries[state.history.index];
  if (!entry || state.history.index < 0) {
    return state;
  }
  return reconcileSelectedLayer(
    reconcilePen({
      ...state,
      document: entry.before.document,
      mode: entry.before.mode,
      selection: entry.before.selection,
      history: { entries: state.history.entries, index: state.history.index - 1 },
    }),
  );
}

function redoSession(state: SessionSlice): SessionSlice {
  const index = state.history.index + 1;
  const entry = state.history.entries[index];
  if (!entry) {
    return state;
  }
  return reconcileSelectedLayer(
    reconcilePen({
      ...state,
      document: entry.after.document,
      mode: entry.after.mode,
      selection: entry.after.selection,
      history: { entries: state.history.entries, index },
    }),
  );
}

function jumpSession(state: SessionSlice, index: number): SessionSlice {
  const { entries } = state.history;
  if (
    !Number.isInteger(index) ||
    index < -1 ||
    index >= entries.length ||
    index === state.history.index
  ) {
    return state;
  }
  const snapshot = index === -1 ? entries[0]?.before : entries[index]?.after;
  if (!snapshot) {
    return state;
  }
  return reconcileSelectedLayer(
    reconcilePen({
      ...state,
      document: snapshot.document,
      mode: snapshot.mode,
      selection: snapshot.selection,
      history: { entries, index },
    }),
  );
}

function applyMode(state: SessionSlice, mode: SessionSlice['mode']): SessionSlice {
  const selection = state.selection;
  const penObjectId = mode === 'edit' ? state.penObjectId : null;
  if (
    state.mode === mode &&
    penObjectId === state.penObjectId &&
    selection.selectedAnchorIds.length === 0 &&
    selection.selectedSegmentIds.length === 0
  ) {
    return state;
  }
  return {
    ...state,
    mode,
    penObjectId,
    selection: {
      ...selection,
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
}

function applyTool(state: SessionSlice, tool: EditorTool): SessionSlice {
  const penObjectId = tool === 'pen' ? state.penObjectId : null;
  if (state.tool === tool && state.penObjectId === penObjectId) {
    return state;
  }
  return { ...state, tool, penObjectId };
}

function applyEditSelectionKind(
  state: SessionSlice,
  kind: SessionSlice['selection']['editSelectionKind'],
): SessionSlice {
  if (state.selection.editSelectionKind === kind) {
    return state;
  }
  return {
    ...state,
    selection: { ...state.selection, editSelectionKind: kind },
  };
}

function applyAnchorSelect(
  state: SessionSlice,
  command: Extract<Command, { type: 'session.select' }>,
): SessionSlice {
  if (state.mode !== 'edit') {
    return state;
  }
  const object = activeObject(state);
  if (!object) {
    return state;
  }
  if (command.op === 'clear') {
    return withAnchorSelection(state, []);
  }
  const known = anchorIds(object);
  const ids = uniqueKnown(command.ids, known);
  if (command.op === 'replace') {
    return withAnchorSelection(state, ids);
  }
  if (command.op === 'add') {
    const current = state.selection.selectedAnchorIds;
    const added = ids.filter((id) => !current.includes(id));
    return withAnchorSelection(state, [...current, ...added]);
  }
  const current = state.selection.selectedAnchorIds;
  const remove = new Set<string>();
  const added: string[] = [];
  for (const id of ids) {
    if (current.includes(id)) {
      remove.add(id);
    } else if (!added.includes(id)) {
      added.push(id);
    }
  }
  return withAnchorSelection(state, [...current.filter((id) => !remove.has(id)), ...added]);
}

function withAnchorSelection(
  state: SessionSlice,
  selectedAnchorIds: readonly string[],
): SessionSlice {
  if (sameIds(state.selection.selectedAnchorIds, selectedAnchorIds)) {
    return state;
  }
  return {
    ...state,
    selection: { ...state.selection, selectedAnchorIds },
  };
}

function applyDeleteAnchors(
  state: SessionSlice,
  command: Extract<Command, { type: 'path.deleteAnchors' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const object = state.document.objects.find((item) => item.id === command.objectId);
  if (!object || isInteractionLocked(state.document, object)) {
    return state;
  }
  const source = deleteAnchors(object.source, command.anchorIds);
  if (source === object.source) {
    return state;
  }
  const document = mapObjects(state.document, [command.objectId], (item) => ({ ...item, source }));
  const removed = new Set(command.anchorIds);
  const selectedAnchorIds = state.selection.selectedAnchorIds.filter((id) => !removed.has(id));
  const selection = sameIds(state.selection.selectedAnchorIds, selectedAnchorIds)
    ? state.selection
    : { ...state.selection, selectedAnchorIds };
  return { ...state, document, selection };
}

function replaceSource(
  state: SessionSlice,
  objectId: string,
  update: (source: SourcePath) => SourcePath,
): SessionSlice {
  const current = state.document;
  if (!current) {
    return state;
  }
  const document = mapObjects(current, [objectId], (object) => {
    if (isInteractionLocked(current, object)) {
      return object;
    }
    const source = update(object.source);
    return source === object.source ? object : { ...object, source };
  });
  return document === state.document ? state : { ...state, document };
}

function activeObject(state: SessionSlice): VectorObject | null {
  const id = state.selection.activeObjectId;
  if (!id || !state.document) {
    return null;
  }
  return state.document.objects.find((object) => object.id === id) ?? null;
}

function anchorIds(object: VectorObject): Set<string> {
  const ids = new Set<string>();
  for (const subpath of object.source.subpaths) {
    for (const anchor of subpath.anchors) {
      ids.add(anchor.id);
    }
  }
  return ids;
}

function applySelect(
  state: SessionSlice,
  command: Extract<Command, { type: 'session.select' }>,
): SessionSlice {
  if (command.op === 'clear') {
    return withObjectSelection(state, [], null, true);
  }

  const known = new Set(state.document?.objects.map((object) => object.id) ?? []);
  const ids = uniqueKnown(command.ids, known);
  if (command.op === 'replace') {
    return withObjectSelection(state, ids, ids.at(-1) ?? null, false);
  }

  if (command.op === 'add') {
    const current = state.selection.selectedObjectIds;
    const added = ids.filter((id) => !current.includes(id));
    const selected = [...current, ...added];
    const active = added.at(-1) ?? state.selection.activeObjectId;
    return withObjectSelection(state, selected, active, false);
  }

  const current = state.selection.selectedObjectIds;
  const remove = new Set<string>();
  const added: string[] = [];
  for (const id of ids) {
    if (current.includes(id)) {
      remove.add(id);
    } else if (!added.includes(id)) {
      added.push(id);
    }
  }
  const selected = [...current.filter((id) => !remove.has(id)), ...added];
  const active =
    added.at(-1) ??
    (selected.includes(state.selection.activeObjectId ?? '')
      ? state.selection.activeObjectId
      : (selected.at(-1) ?? null));
  return withObjectSelection(state, selected, active, false);
}

function withObjectSelection(
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

function applyTranslate(
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

function applyTransform(
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

function applyFlags(
  state: SessionSlice,
  command: Extract<Command, { type: 'object.setFlags' }>,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) => withFlags(object, command));
  return document === state.document ? state : { ...state, document };
}

function applyDuplicate(
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

function applyPenBegin(
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

function applyPenAddPoint(
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

function applyPenSetHandles(
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

function applyPenFinish(
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

function penSelection(
  selection: SelectionState,
  objectId: string,
  anchorId: string,
  replaceObjects: boolean,
): SelectionState {
  const selectedObjectIds =
    replaceObjects || !selection.selectedObjectIds.includes(objectId)
      ? [objectId]
      : selection.selectedObjectIds;
  return {
    ...selection,
    activeObjectId: objectId,
    selectedObjectIds,
    selectedAnchorIds: [anchorId],
    selectedSegmentIds: [],
  };
}

function reconcilePen(state: SessionSlice): SessionSlice {
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

function withTransform(object: VectorObject, patch: Partial<ObjectTransform>): VectorObject {
  const transform = { ...object.transform };
  let changed = false;
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const) {
    const value = patch[key];
    if (value !== undefined && value !== transform[key]) {
      transform[key] = value;
      changed = true;
    }
  }
  return changed ? { ...object, transform } : object;
}

function withFlags(
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

function applyObjectChange(
  state: SessionSlice,
  objectId: string,
  update: (object: VectorObject) => VectorObject,
): SessionSlice {
  return applyDocument(state, (document) => mapObjects(document, [objectId], update));
}

function applyBakedModifier(
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

function applySelectLayer(state: SessionSlice, id: string): SessionSlice {
  if (state.selectedLayerId === id) {
    return state;
  }
  if (!state.document?.layers.some((layer) => layer.id === id)) {
    return state;
  }
  return { ...state, selectedLayerId: id };
}

function applyAddLayer(state: SessionSlice): SessionSlice {
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

function applyAddPath(state: SessionSlice, layerId: string): SessionSlice {
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

function defaultLayerId(document: Document): string | null {
  return layersFrontToBack(document)[0]?.id ?? null;
}

function reconcileSelectedLayer(state: SessionSlice): SessionSlice {
  const document = state.document;
  if (!document) {
    return state.selectedLayerId === null ? state : { ...state, selectedLayerId: null };
  }
  if (document.layers.some((layer) => layer.id === state.selectedLayerId)) {
    return state;
  }
  const fallback = defaultLayerId(document);
  return state.selectedLayerId === fallback ? state : { ...state, selectedLayerId: fallback };
}

function applyDocument(
  state: SessionSlice,
  update: (document: Document) => Document,
): SessionSlice {
  if (!state.document) {
    return state;
  }
  const document = update(state.document);
  return document === state.document ? state : { ...state, document };
}

function mapObjects(
  document: Document,
  ids: readonly string[],
  update: (object: VectorObject) => VectorObject,
): Document {
  if (ids.length === 0) {
    return document;
  }
  const wanted = new Set(ids);
  let changed = false;
  const objects = document.objects.map((object) => {
    if (!wanted.has(object.id)) {
      return object;
    }
    const next = update(object);
    if (next !== object) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...document, objects } : document;
}

function uniqueKnown(ids: readonly string[], known: ReadonlySet<string>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }
  return result;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
