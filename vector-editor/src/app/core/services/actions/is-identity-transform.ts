import { identityTransform } from "@vector-editor/modules/io";
import { ObjectTransform } from "@vector-editor/modules/types";

export function isIdentityTransform(transform: ObjectTransform): boolean {
  return (
    transform.x === identityTransform.x &&
    transform.y === identityTransform.y &&
    transform.rotation === identityTransform.rotation &&
    transform.scaleX === identityTransform.scaleX &&
    transform.scaleY === identityTransform.scaleY &&
    transform.originX === identityTransform.originX &&
    transform.originY === identityTransform.originY
  );
}

