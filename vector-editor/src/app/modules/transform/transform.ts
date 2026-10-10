import { ObjectTransform, Vec2 } from '../types';

/** Document position of the point rotation keeps fixed. */
export function rotationOriginDocument(transform: ObjectTransform): Vec2 {
  return {
    x: transform.x + transform.originX * transform.scaleX,
    y: transform.y + transform.originY * transform.scaleY,
  };
}

/**
 * Moves the rotation point to `point` in document space.
 * Translation is adjusted so the drawn geometry stays where it is.
 */
export function transformWithRotationOrigin(
  transform: ObjectTransform,
  point: Vec2,
): ObjectTransform | null {
  if (transform.scaleX === 0 || transform.scaleY === 0) {
    return null;
  }
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const { x: tx, y: ty, originX: ox, originY: oy, scaleX: sx, scaleY: sy } = transform;
  const shiftedX = point.x - tx - ox * sx * (1 - cos) - oy * sy * sin;
  const shiftedY = point.y - ty + ox * sx * sin - oy * sy * (1 - cos);
  const originX = (shiftedX * cos + shiftedY * sin) / sx;
  const originY = (-shiftedX * sin + shiftedY * cos) / sy;
  const x = point.x - originX * sx;
  const y = point.y - originY * sy;
  if (x === tx && y === ty && originX === ox && originY === oy) {
    return null;
  }
  return { ...transform, x, y, originX, originY };
}
