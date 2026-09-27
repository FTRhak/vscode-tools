import { computed, Service, signal } from '@angular/core';
import { Command, EditorMode, EditorTool } from '../commands/command';
import {
  emptyHistory,
  emptySelection,
  HistoryState,
  historyLabel,
  recordHistory,
  SelectionState,
  SessionSnapshot,
} from '../commands/history';
import { createNewDocument } from './model/create-document';
import { duplicateObjects } from './model/duplicate-objects';
import {
  deleteAnchors,
  setAnchorHandle,
  setAnchorPosition,
  translateAnchors,
} from './model/edit-path';
import { Document, ObjectTransform, SourcePath, VectorObject, ViewportCamera } from './model/types';

export interface SessionSlice {
  readonly mode: EditorMode;
  readonly tool: EditorTool;
  readonly document: Document | null;
  readonly viewport: ViewportCamera;
  readonly selection: SelectionState;
  readonly history: HistoryState;
}

const initialSession: SessionSlice = {
  mode: 'object',
  tool: 'select',
  document: null,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  selection: emptySelection,
  history: emptyHistory,
};

type DocumentCommand = Exclude<Command, { type: 'history.undo' } | { type: 'history.redo' }>;

export function applySessionCommand(state: SessionSlice, command: DocumentCommand): SessionSlice {
  switch (command.type) {
    case 'session.setMode':
      return applyMode(state, command.mode);
    case 'session.setTool':
      return { ...state, tool: command.tool };
    case 'session.setEditSelectionKind':
      return applyEditSelectionKind(state, command.kind);
    case 'document.new':
      return { ...state, document: createNewDocument(), selection: emptySelection };
    case 'session.setViewport':
      return {
        ...state,
        viewport: { panX: command.panX, panY: command.panY, zoom: command.zoom },
      };
    case 'session.select':
      return command.target === 'anchor'
        ? applyAnchorSelect(state, command)
        : applySelect(state, command);
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
  }
}

export function commitSession(state: SessionSlice, command: Command): SessionSlice {
  if (command.type === 'history.undo') {
    return undoSession(state);
  }
  if (command.type === 'history.redo') {
    return redoSession(state);
  }

  const next = applySessionCommand(state, command);
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

  apply(command: Command): void {
    this.state.update((current) => commitSession(current, command));
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
  return {
    ...state,
    document: entry.before.document,
    mode: entry.before.mode,
    selection: entry.before.selection,
    history: { entries: state.history.entries, index: state.history.index - 1 },
  };
}

function redoSession(state: SessionSlice): SessionSlice {
  const index = state.history.index + 1;
  const entry = state.history.entries[index];
  if (!entry) {
    return state;
  }
  return {
    ...state,
    document: entry.after.document,
    mode: entry.after.mode,
    selection: entry.after.selection,
    history: { entries: state.history.entries, index },
  };
}

function applyMode(state: SessionSlice, mode: SessionSlice['mode']): SessionSlice {
  const selection = state.selection;
  if (
    state.mode === mode &&
    selection.selectedAnchorIds.length === 0 &&
    selection.selectedSegmentIds.length === 0
  ) {
    return state;
  }
  return {
    ...state,
    mode,
    selection: {
      ...selection,
      selectedAnchorIds: [],
      selectedSegmentIds: [],
    },
  };
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
  if (!object || object.locked) {
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
  if (!state.document) {
    return state;
  }
  const document = mapObjects(state.document, [objectId], (object) => {
    if (object.locked) {
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
  if (!state.document || !Number.isFinite(command.dx) || !Number.isFinite(command.dy)) {
    return state;
  }
  if (command.dx === 0 && command.dy === 0) {
    return state;
  }
  const document = mapObjects(state.document, command.ids, (object) => {
    if (object.locked) {
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
