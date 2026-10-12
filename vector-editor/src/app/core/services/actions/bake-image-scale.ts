import { VectorObject } from "@vector-editor/modules/types";

export function bakeImageScale(object: VectorObject): VectorObject {
  const image = object.image;
  if (!image || (object.transform.scaleX === 1 && object.transform.scaleY === 1)) {
    return object;
  }
  const width = image.width * object.transform.scaleX;
  const height = image.height * object.transform.scaleY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return object;
  }
  return {
    ...object,
    image: { ...image, width, height },
    transform: { ...object.transform, scaleX: 1, scaleY: 1 },
  };
}