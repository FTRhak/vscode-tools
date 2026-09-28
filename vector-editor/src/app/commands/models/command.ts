import type { ModifierKind, ModifierPatch } from '../../core/model/modifier-edits';
import type { Document, ObjectTransform, Vec2 } from '../../core/model/types';

export type ColorSlot = 'fill' | 'stroke';

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
  | { readonly type: 'document.replace'; readonly document: Document }
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
  | {
      readonly type: 'style.set';
      readonly objectIds: readonly string[];
      readonly fill?: string | null;
      readonly stroke?: string | null;
      readonly strokeWidth?: number;
    }
  | { readonly type: 'swatch.add'; readonly name: string; readonly color: string }
  | {
      readonly type: 'swatch.apply';
      readonly swatchId: string;
      readonly target: ColorSlot;
      readonly objectIds: readonly string[];
    }
  | { readonly type: 'layer.add' }
  | {
      readonly type: 'layer.update';
      readonly id: string;
      readonly name?: string;
      readonly visible?: boolean;
      readonly locked?: boolean;
    }
  | { readonly type: 'layer.reorder'; readonly id: string; readonly index: number }
  | { readonly type: 'pen.begin'; readonly position: Vec2 }
  | { readonly type: 'pen.addPoint'; readonly objectId: string; readonly position: Vec2 }
  | {
      readonly type: 'pen.setHandles';
      readonly objectId: string;
      readonly anchorId: string;
      readonly handleOut: Vec2;
      readonly breakLink: boolean;
      readonly gesture: TranslateGesture;
    }
  | { readonly type: 'pen.finish'; readonly objectId: string; readonly closed: boolean }
  | {
      readonly type: 'modifier.add';
      readonly objectId: string;
      readonly kind: ModifierKind;
    }
  | {
      readonly type: 'modifier.update';
      readonly objectId: string;
      readonly modifierId: string;
      readonly patch: ModifierPatch;
    }
  | { readonly type: 'modifier.remove'; readonly objectId: string; readonly modifierId: string }
  | {
      readonly type: 'modifier.reorder';
      readonly objectId: string;
      readonly modifierId: string;
      readonly index: number;
    }
  | { readonly type: 'modifier.apply'; readonly objectId: string; readonly modifierId: string }
  | { readonly type: 'modifier.applyAll'; readonly objectId: string }
  | { readonly type: 'history.undo' }
  | { readonly type: 'history.redo' }
  | { readonly type: 'history.jump'; readonly index: number };

export function oppositeMode(mode: EditorMode): EditorMode {
  return mode === 'object' ? 'edit' : 'object';
}
