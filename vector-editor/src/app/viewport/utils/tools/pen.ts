import { Anchor, Vec2, VectorObject } from '@vector-editor/modules/types/types';
import { Command, EditorMode } from '../../../commands/models/command';
import { anchorHitRadius } from '../anchor-hit';

export const PEN_DRAG_THRESHOLD_PX = 4;

export interface PenDrag {
  readonly pointerId: number;
  readonly originX: number;
  readonly originY: number;
  readonly objectId: string;
  readonly anchorId: string;
  moved: boolean;
}

export interface PenStart {
  readonly commands: readonly Command[];
  readonly place: boolean;
}

export function startPen(input: {
  readonly mode: EditorMode;
  readonly documentPoint: Vec2;
  readonly zoom: number;
  readonly penObject: VectorObject | null;
  readonly activeObject: VectorObject | null;
  readonly localPoint: Vec2 | null;
  readonly isBlocked?: (object: VectorObject) => boolean;
}): PenStart {
  if (input.penObject) {
    return placeOn(input.penObject, input.localPoint, input.zoom, input.isBlocked);
  }
  if (input.mode === 'edit') {
    const active = input.activeObject;
    if (active && openSubpath(active, input.isBlocked)) {
      return placeOn(active, input.localPoint, input.zoom, input.isBlocked);
    }
    return { commands: [], place: false };
  }
  if (!Number.isFinite(input.documentPoint.x) || !Number.isFinite(input.documentPoint.y)) {
    return { commands: [], place: false };
  }
  return {
    commands: [{ type: 'pen.begin', position: input.documentPoint }],
    place: true,
  };
}

export function updatePenDrag(
  drag: PenDrag,
  input: {
    readonly clientX: number;
    readonly clientY: number;
    readonly altKey: boolean;
    readonly localPoint: Vec2 | null;
  },
): readonly Command[] {
  if (!drag.moved) {
    const distance = Math.hypot(input.clientX - drag.originX, input.clientY - drag.originY);
    if (distance < PEN_DRAG_THRESHOLD_PX) {
      return [];
    }
    drag.moved = true;
  }
  if (!input.localPoint) {
    return [];
  }
  return [
    {
      type: 'pen.setHandles',
      objectId: drag.objectId,
      anchorId: drag.anchorId,
      handleOut: input.localPoint,
      breakLink: input.altKey,
      gesture: 'continue',
    },
  ];
}

export function penPreviewData(from: Anchor, to: Vec2): string {
  const move = `M ${formatCoordinate(from.position.x)} ${formatCoordinate(from.position.y)}`;
  if (!from.handleOut) {
    return `${move} L ${formatCoordinate(to.x)} ${formatCoordinate(to.y)}`;
  }
  const handle = from.handleOut;
  return `${move} C ${formatCoordinate(handle.x)} ${formatCoordinate(handle.y)} ${formatCoordinate(to.x)} ${formatCoordinate(to.y)} ${formatCoordinate(to.x)} ${formatCoordinate(to.y)}`;
}

function placeOn(
  object: VectorObject,
  localPoint: Vec2 | null,
  zoom: number,
  isBlocked?: (object: VectorObject) => boolean,
): PenStart {
  const subpath = openSubpath(object, isBlocked);
  const first = subpath?.anchors[0];
  if (!subpath || !first || !localPoint) {
    return { commands: [], place: false };
  }
  const radius = anchorHitRadius(zoom, object.transform);
  const nearStart =
    Math.hypot(localPoint.x - first.position.x, localPoint.y - first.position.y) <= radius;
  if (nearStart && subpath.anchors.length >= 2) {
    return {
      commands: [{ type: 'pen.finish', objectId: object.id, closed: true }],
      place: false,
    };
  }
  if (nearStart) {
    return { commands: [], place: false };
  }
  return {
    commands: [{ type: 'pen.addPoint', objectId: object.id, position: localPoint }],
    place: true,
  };
}

function openSubpath(object: VectorObject, isBlocked?: (object: VectorObject) => boolean) {
  if (isBlocked?.(object) ?? object.locked) {
    return null;
  }
  const subpath = object.source.subpaths.at(-1);
  if (!subpath || subpath.closed || subpath.anchors.length === 0) {
    return null;
  }
  return subpath;
}

function formatCoordinate(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '');
}
