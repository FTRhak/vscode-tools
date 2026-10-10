import { ObjectTransform, Vec2, VectorObject } from '@vector-editor/modules/types';
import { Command, TranslateGesture } from '../../../commands/models/command';
import { AnchorHit, anchorHitRadius, hitTestAnchor } from '../anchor-hit';
import { documentDeltaToLocal } from '../hit-test';

export const DIRECT_SELECT_THRESHOLD_PX = 4;

export interface DirectDrag {
  readonly pointerId: number;
  readonly originX: number;
  readonly originY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  mode: 'pending' | 'anchors' | 'handle' | 'marquee';
  moveSent: boolean;
  readonly hit: AnchorHit | null;
  readonly canMove: boolean;
  readonly objectId: string;
}

export function beginDirectDrag(input: {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly shiftKey: boolean;
  readonly object: VectorObject;
  readonly blocked: boolean;
  readonly localPoint: Vec2;
  readonly zoom: number;
  readonly selectedAnchorIds: readonly string[];
}): { readonly drag: DirectDrag; readonly commands: readonly Command[] } {
  const hit = hitTestAnchor(input.object.source, input.localPoint, anchorHitRadius(input.zoom, input.object.transform));
  const commands: Command[] = [];
  if (hit?.kind === 'anchor' && !input.selectedAnchorIds.includes(hit.anchorId)) {
    commands.push(selectAnchor(hit.anchorId, input.shiftKey));
  }
  if (hit?.kind === 'handle') {
    commands.push(selectAnchor(hit.anchorId, input.shiftKey));
  }
  return {
    drag: {
      pointerId: input.pointerId,
      originX: input.clientX,
      originY: input.clientY,
      lastX: input.clientX,
      lastY: input.clientY,
      moved: false,
      mode: 'pending',
      moveSent: false,
      hit,
      canMove: !input.blocked,
      objectId: input.object.id,
    },
    commands,
  };
}

export function updateDirectDrag(
  drag: DirectDrag,
  input: {
    readonly clientX: number;
    readonly clientY: number;
    readonly altKey: boolean;
    readonly localPoint: Vec2;
    readonly localDelta?: Vec2 | null;
    readonly zoom: number;
    readonly transform: ObjectTransform;
    readonly selectedAnchorIds: readonly string[];
  },
): readonly Command[] {
  const distance = Math.hypot(input.clientX - drag.originX, input.clientY - drag.originY);
  if (!drag.moved) {
    if (distance < DIRECT_SELECT_THRESHOLD_PX) {
      return [];
    }
    drag.moved = true;
    if (drag.hit?.kind === 'anchor' && drag.canMove) {
      drag.mode = 'anchors';
    } else if (drag.hit?.kind === 'handle' && drag.canMove) {
      drag.mode = 'handle';
    } else if (!drag.hit) {
      drag.mode = 'marquee';
    }
  }

  if (drag.mode === 'anchors') {
    return moveAnchors(drag, input);
  }
  if (drag.mode === 'handle' && drag.hit?.kind === 'handle') {
    return moveHandle(drag, drag.hit, input);
  }
  return [];
}

export function finishDirectDrag(
  drag: DirectDrag,
  input: { readonly shiftKey: boolean; readonly anchorIds: readonly string[] },
): readonly Command[] {
  if (drag.mode === 'marquee') {
    return [
      {
        type: 'session.select',
        target: 'anchor',
        ids: input.anchorIds,
        op: input.shiftKey ? 'add' : 'replace',
      },
    ];
  }
  if (!drag.moved && !drag.hit && !input.shiftKey) {
    return [{ type: 'session.select', target: 'anchor', ids: [], op: 'clear' }];
  }
  return [];
}

function moveAnchors(
  drag: DirectDrag,
  input: {
    readonly clientX: number;
    readonly clientY: number;
    readonly localDelta?: Vec2 | null;
    readonly zoom: number;
    readonly transform: ObjectTransform;
    readonly selectedAnchorIds: readonly string[];
  },
): readonly Command[] {
  const zoom = input.zoom || 1;
  const local =
    input.localDelta ?? documentDeltaToLocal(input.transform, (input.clientX - drag.lastX) / zoom, (input.clientY - drag.lastY) / zoom);
  drag.lastX = input.clientX;
  drag.lastY = input.clientY;
  if (!local || (local.x === 0 && local.y === 0) || input.selectedAnchorIds.length === 0) {
    return [];
  }
  const gesture = nextGesture(drag);
  return [
    {
      type: 'path.translateAnchors',
      objectId: drag.objectId,
      anchorIds: input.selectedAnchorIds,
      dx: local.x,
      dy: local.y,
      gesture,
    },
  ];
}

function moveHandle(
  drag: DirectDrag,
  hit: Extract<AnchorHit, { kind: 'handle' }>,
  input: {
    readonly clientX: number;
    readonly clientY: number;
    readonly altKey: boolean;
    readonly localPoint: Vec2;
  },
): readonly Command[] {
  drag.lastX = input.clientX;
  drag.lastY = input.clientY;
  const gesture = nextGesture(drag);
  return [
    {
      type: 'path.setHandle',
      objectId: drag.objectId,
      anchorIds: [hit.anchorId],
      slot: hit.slot,
      position: input.localPoint,
      breakLink: input.altKey,
      gesture,
    },
  ];
}

function nextGesture(drag: DirectDrag): TranslateGesture {
  const gesture: TranslateGesture = drag.moveSent ? 'continue' : 'begin';
  drag.moveSent = true;
  return gesture;
}

function selectAnchor(anchorId: string, shiftKey: boolean): Command {
  return {
    type: 'session.select',
    target: 'anchor',
    ids: [anchorId],
    op: shiftKey ? 'add' : 'replace',
  };
}
