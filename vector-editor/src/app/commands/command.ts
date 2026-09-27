export type EditorMode = 'object' | 'edit';

export type EditorTool = 'select' | 'direct-select' | 'pen';

export type Command =
  | { readonly type: 'session.setMode'; readonly mode: EditorMode }
  | { readonly type: 'session.setTool'; readonly tool: EditorTool }
  | { readonly type: 'document.new' }
  | {
      readonly type: 'session.setViewport';
      readonly panX: number;
      readonly panY: number;
      readonly zoom: number;
    };

export function oppositeMode(mode: EditorMode): EditorMode {
  return mode === 'object' ? 'edit' : 'object';
}
