import { Command } from "@vector-editor/commands";
import { identityTransform, matrixFromTransform, transformSource } from "@vector-editor/modules/io";
import { isImage } from "@vector-editor/modules/object-image";
import { isInteractionLocked } from "@vector-editor/modules/paint-order";
import { SessionSlice } from "@vector-editor/modules/types";
import { bakeImageScale } from "./bake-image-scale";
import { mapObjects } from "./document-helpers";
import { isIdentityTransform } from "./is-identity-transform";

export function applyBakedTransform(state: SessionSlice, command: Extract<Command, { type: 'object.applyTransform' }>): SessionSlice {
  const current = state.document;
  if (!current) {
    return state;
  }
  const document = mapObjects(current, [command.id], (object) => {
    if (isInteractionLocked(current, object) || isIdentityTransform(object.transform)) {
      return object;
    }
    if (isImage(object)) {
      return bakeImageScale(object);
    }
    return {
      ...object,
      source: transformSource(object.source, matrixFromTransform(object.transform)),
      transform: identityTransform,
    };
  });
  return document === current ? state : { ...state, document };
}