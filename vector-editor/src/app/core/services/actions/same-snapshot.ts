import { SessionSnapshot } from "@vector-editor/commands";

export function sameSnapshot(before: SessionSnapshot, after: SessionSnapshot): boolean {
  return (
    before.document === after.document &&
    before.mode === after.mode &&
    before.selection === after.selection
  );
}