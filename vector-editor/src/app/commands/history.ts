import type { Document } from '../core/model/types';
import type { Command, EditSelectionKind, EditorMode } from './command';

export interface SelectionState {
  readonly activeObjectId: string | null;
  readonly selectedObjectIds: readonly string[];
  readonly editSelectionKind: EditSelectionKind;
  readonly selectedAnchorIds: readonly string[];
  readonly selectedSegmentIds: readonly string[];
}

export interface SessionSnapshot {
  readonly document: Document | null;
  readonly mode: EditorMode;
  readonly selection: SelectionState;
}

export interface HistoryEntry {
  readonly label: string;
  readonly before: SessionSnapshot;
  readonly after: SessionSnapshot;
}

export interface HistoryState {
  readonly entries: readonly HistoryEntry[];
  readonly index: number;
}

export const emptySelection: SelectionState = {
  activeObjectId: null,
  selectedObjectIds: [],
  editSelectionKind: 'anchor',
  selectedAnchorIds: [],
  selectedSegmentIds: [],
};

export const emptyHistory: HistoryState = {
  entries: [],
  index: -1,
};

export function historyLabel(command: Command): string | null {
  switch (command.type) {
    case 'document.new':
      return 'New document';
    case 'document.replace':
      return 'Open';
    case 'session.select':
      return 'Select';
    case 'object.translate':
      return 'Move';
    case 'object.setTransform':
      return 'Set transform';
    case 'object.duplicate':
      return 'Duplicate';
    case 'object.setFlags':
      if (command.name !== undefined) {
        return 'Rename';
      }
      if (command.visible !== undefined) {
        return command.visible ? 'Show' : 'Hide';
      }
      if (command.locked !== undefined) {
        return command.locked ? 'Lock' : 'Unlock';
      }
      return null;
    case 'path.translateAnchors':
      return 'Move anchors';
    case 'path.setAnchor':
      return 'Set anchor';
    case 'path.setHandle':
      return command.gesture ? 'Move handle' : 'Set handle';
    case 'path.deleteAnchors':
      return 'Delete anchors';
    case 'style.set':
      return styleLabel(command);
    case 'swatch.add':
      return 'Add swatch';
    case 'swatch.apply':
      return 'Apply swatch';
    case 'layer.add':
      return 'Add layer';
    case 'layer.update':
      if (command.name !== undefined) {
        return 'Rename layer';
      }
      if (command.visible !== undefined) {
        return command.visible ? 'Show layer' : 'Hide layer';
      }
      if (command.locked !== undefined) {
        return command.locked ? 'Lock layer' : 'Unlock layer';
      }
      return null;
    case 'layer.reorder':
      return 'Reorder layer';
    case 'pen.begin':
    case 'pen.addPoint':
    case 'pen.setHandles':
      return 'Pen';
    case 'pen.finish':
      return command.closed ? 'Close path' : null;
    case 'modifier.add':
      return 'Add modifier';
    case 'modifier.update':
      return 'Update modifier';
    case 'modifier.remove':
      return 'Remove modifier';
    case 'modifier.reorder':
      return 'Reorder modifier';
    case 'modifier.apply':
      return 'Apply modifier';
    case 'modifier.applyAll':
      return 'Apply modifiers';
    case 'session.setMode':
    case 'session.setTool':
    case 'session.setViewport':
    case 'session.setEditSelectionKind':
    case 'history.undo':
    case 'history.redo':
    case 'history.jump':
      return null;
  }
}

export function recordHistory(
  history: HistoryState,
  label: string,
  before: SessionSnapshot,
  after: SessionSnapshot,
  command: Command,
): HistoryState {
  const current = history.entries[history.index];
  const canCoalesce =
    history.index === history.entries.length - 1 && gestureContinues(command, current?.label);

  if (canCoalesce && current) {
    const entries = history.entries.slice(0, -1);
    entries.push({ label: current.label, before: current.before, after });
    return { entries, index: history.index };
  }

  const entries = history.entries.slice(0, history.index + 1);
  entries.push({ label, before, after });
  return { entries, index: entries.length - 1 };
}

function styleLabel(command: Extract<Command, { type: 'style.set' }>): string {
  const labels = [
    command.fill !== undefined ? 'Set fill' : null,
    command.stroke !== undefined ? 'Set stroke' : null,
    command.strokeWidth !== undefined ? 'Set stroke width' : null,
  ].filter((label) => label !== null);
  return labels.length === 1 && labels[0] ? labels[0] : 'Set style';
}

function gestureContinues(command: Command, label: string | undefined): boolean {
  if (command.type === 'object.translate' && command.gesture === 'continue') {
    return label === 'Move';
  }
  if (command.type === 'path.translateAnchors' && command.gesture === 'continue') {
    return label === 'Move anchors';
  }
  if (command.type === 'path.setHandle' && command.gesture === 'continue') {
    return label === 'Move handle';
  }
  if (command.type === 'pen.setHandles' && command.gesture === 'continue') {
    return label === 'Pen';
  }
  return false;
}
