import { ImageAspect, Vec2 } from '@vector-editor/core';

export interface ImageFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly preserveAspectRatio: ImageAspect;
}

export function imageFrameAt(origin: Vec2, pixelWidth: number, pixelHeight: number): ImageFrame | null {
  if (!positive(pixelWidth) || !positive(pixelHeight)) {
    return null;
  }
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) {
    return null;
  }
  return {
    x: origin.x,
    y: origin.y,
    width: pixelWidth,
    height: pixelHeight,
    preserveAspectRatio: 'xMidYMid meet',
  };
}

export function imageFrameFromDrag(
  origin: Vec2,
  current: Vec2,
  pixelWidth: number,
  pixelHeight: number,
  shift: boolean,
): ImageFrame | null {
  if (!positive(pixelWidth) || !positive(pixelHeight)) {
    return null;
  }
  let width = current.x - origin.x;
  let height = current.y - origin.y;
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (shift) {
    const aspect = pixelWidth / pixelHeight;
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);
    if (absWidth / aspect >= absHeight) {
      height = Math.sign(height) * (absWidth / aspect) || absWidth / aspect;
    } else {
      width = Math.sign(width) * (absHeight * aspect) || absHeight * aspect;
    }
  }
  const frameWidth = Math.abs(width);
  const frameHeight = Math.abs(height);
  if (frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }
  return {
    x: width < 0 ? origin.x + width : origin.x,
    y: height < 0 ? origin.y + height : origin.y,
    width: frameWidth,
    height: frameHeight,
    preserveAspectRatio: shift ? 'xMidYMid meet' : 'none',
  };
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
