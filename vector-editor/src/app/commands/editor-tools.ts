import { EditorTool } from './command';

export interface EditorToolDefinition {
  readonly id: EditorTool;
  readonly label: string;
  readonly shortcut: string;
}

export const EDITOR_TOOLS: readonly EditorToolDefinition[] = [
  { id: 'select', label: 'Select', shortcut: 'V' },
  { id: 'direct-select', label: 'Direct select', shortcut: 'A' },
  { id: 'pen', label: 'Pen', shortcut: 'P' },
];
