import { EditorTool } from './command';

export interface EditorToolDefinition {
  readonly id: EditorTool;
  readonly label: string;
  readonly shortcut: string;
  readonly group?: string;
}

export interface EditorToolGroup {
  readonly label: string | null;
  readonly tools: readonly EditorToolDefinition[];
}

export const EDITOR_TOOLS: readonly EditorToolDefinition[] = [
  { id: 'select', label: 'Select', shortcut: 'V' },
  { id: 'direct-select', label: 'Direct select', shortcut: 'A' },
  { id: 'pen', label: 'Pen', shortcut: 'P' },
  { id: 'add-point', label: 'Add point', shortcut: '+' },
  { id: 'empty-point', label: 'Empty point', shortcut: 'E' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'M', group: 'Shapes' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'L', group: 'Shapes' },
  { id: 'star', label: 'Star', shortcut: 'S', group: 'Shapes' },
  { id: 'polygon', label: 'Polygon', shortcut: 'N', group: 'Shapes' },
  { id: 'rhombus', label: 'Rhombus', shortcut: 'R', group: 'Shapes' },
  { id: 'image', label: 'Add image', shortcut: 'I', group: 'Image' },
];

export function editorToolGroups(
  tools: readonly EditorToolDefinition[] = EDITOR_TOOLS,
): readonly EditorToolGroup[] {
  const groups: { label: string | null; tools: EditorToolDefinition[] }[] = [];
  for (const tool of tools) {
    const label = tool.group ?? null;
    const current = groups.at(-1);
    if (current && current.label === label) {
      current.tools.push(tool);
    } else {
      groups.push({ label, tools: [tool] });
    }
  }
  return groups;
}
