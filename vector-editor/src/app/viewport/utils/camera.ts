import { Vec2, ViewBox, ViewportCamera } from '@vector-editor/core';

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;
export const ARTBOARD_FIT_PADDING = 24;

const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 800;
const WHEEL_ZOOM_SPEED = 0.0015;

export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

export function fitArtboard(viewSize: ViewSize, viewBox: ViewBox, padding: number): ViewportCamera {
  const availableWidth = Math.max(viewSize.width - padding * 2, 1);
  const availableHeight = Math.max(viewSize.height - padding * 2, 1);
  const zoom = clamp(
    Math.min(availableWidth / viewBox.width, availableHeight / viewBox.height),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  return {
    zoom,
    panX: (viewSize.width - viewBox.width * zoom) / 2 - viewBox.x * zoom,
    panY: (viewSize.height - viewBox.height * zoom) / 2 - viewBox.y * zoom,
  };
}

export function zoomAtPoint(
  viewport: ViewportCamera,
  cursor: Vec2,
  factor: number,
): ViewportCamera {
  const zoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const documentX = (cursor.x - viewport.panX) / viewport.zoom;
  const documentY = (cursor.y - viewport.panY) / viewport.zoom;
  return {
    zoom,
    panX: cursor.x - documentX * zoom,
    panY: cursor.y - documentY * zoom,
  };
}

export function screenToDocument(camera: ViewportCamera, screen: Vec2): Vec2 {
  return {
    x: (screen.x - camera.panX) / camera.zoom,
    y: (screen.y - camera.panY) / camera.zoom,
  };
}

export function panBy(viewport: ViewportCamera, dx: number, dy: number): ViewportCamera {
  return {
    panX: viewport.panX + dx,
    panY: viewport.panY + dy,
    zoom: viewport.zoom,
  };
}

export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const pixels =
    deltaMode === WheelEvent.DOM_DELTA_LINE
      ? deltaY * LINE_HEIGHT_PX
      : deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? deltaY * PAGE_HEIGHT_PX
        : deltaY;
  return Math.exp(-pixels * WHEEL_ZOOM_SPEED);
}

export function cameraTransformAttribute(camera: ViewportCamera): string {
  return `translate(${camera.panX} ${camera.panY}) scale(${camera.zoom})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
