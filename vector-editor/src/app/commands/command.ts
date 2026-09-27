import type { ObjectTransform, Vec2 } from '../core/model/types';

export type EditorMode = 'object' | 'edit';

export type EditorTool = 'select' | 'direct-select' | 'pen';

export type SelectOperation = 'replace' | 'add' | 'toggle' | 'clear';

export type SelectTarget = 'object' | 'anchor';

export type TranslateGesture = 'begin' | 'continue';

export type EditSelectionKind = 'anchor' | 'segment';

export type HandleSlot = 'in' | 'out';

export type Command =
  | { readonly type: 'session.setMode'; readonly mode: EditorMode }
  | { readonly type: 'session.setTool'; readonly tool: EditorTool }
  | { readonly type: 'session.setEditSelectionKind'; readonly kind: EditSelectionKind }
  | { readonly type: 'document.new' }
  | {
      readonly type: 'session.setViewport';
      readonly panX: number;
      readonly panY: number;
      readonly zoom: number;
    }
  | {
      readonly type: 'session.select';
      readonly target: SelectTarget;
      readonly ids: readonly string[];
      readonly op: SelectOperation;
    }
  | {
      readonly type: 'path.translateAnchors';
      readonly objectId: string;
      readonly anchorIds: readonly string[];
      readonly dx: number;
      readonly dy: number;
      readonly gesture: TranslateGesture;
    }
  | {
      readonly type: 'path.setAnchor';
      readonly objectId: string;
      readonly anchorIds: readonly string[];
      readonly position: Partial<Vec2>;
    }
  | {
      readonly type: 'path.setHandle';
      readonly objectId: string;
      readonly anchorIds: readonly string[];
      readonly slot: HandleSlot;
      readonly position: Partial<Vec2>;
      readonly breakLink: boolean;
      readonly gesture?: TranslateGesture;
    }
  | {
      readonly type: 'path.deleteAnchors';
      readonly objectId: string;
      readonly anchorIds: readonly string[];
    }
  | {
      readonly type: 'object.translate';
      readonly ids: readonly string[];
      readonly dx: number;
      readonly dy: number;
      readonly gesture: TranslateGesture;
    }
  | {
      readonly type: 'object.setTransform';
      readonly ids: readonly string[];
      readonly transform: Partial<ObjectTransform>;
    }
  | {
      readonly type: 'object.setFlags';
      readonly ids: readonly string[];
      readonly name?: string;
      readonly visible?: boolean;
      readonly locked?: boolean;
    }
  | { readonly type: 'object.duplicate'; readonly ids: readonly string[] }
  | { readonly type: 'history.undo' }
  | { readonly type: 'history.redo' };

export function oppositeMode(mode: EditorMode): EditorMode {
  return mode === 'object' ? 'edit' : 'object';
}
