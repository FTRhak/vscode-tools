import { isImage } from "@vector-editor/modules/object-image";
import { isInteractionLocked } from "@vector-editor/modules/paint-order";
import { SessionSlice, SourcePath } from "@vector-editor/modules/types";
import { mapObjects } from "./document-helpers";

export function replaceSource(
  state: SessionSlice,
  objectId: string,
  update: (source: SourcePath) => SourcePath,
): SessionSlice {
  const current = state.document;
  if (!current) {
    return state;
  }
  const document = mapObjects(current, [objectId], (object) => {
    if (isInteractionLocked(current, object) || isImage(object)) {
      return object;
    }
    const source = update(object.source);
    return source === object.source ? object : { ...object, source };
  });
  return document === state.document ? state : { ...state, document };
}