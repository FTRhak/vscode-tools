import { Command } from "@vector-editor/commands";

export type DocumentCommand = Exclude<
  Command,
  { type: 'history.undo' } | { type: 'history.redo' } | { type: 'history.jump' }
>;
