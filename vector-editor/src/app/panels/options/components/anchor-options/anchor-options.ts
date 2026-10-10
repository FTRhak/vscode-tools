import { Component, computed, inject, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CommandBus } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
import { anchorPointType, AnchorPointType } from '@vector-editor/modules/edit-path';
import { Anchor } from '@vector-editor/modules/types';

interface AnchorDraft {
  readonly x: number | null;
  readonly y: number | null;
  readonly handleInX: number | null;
  readonly handleInY: number | null;
  readonly handleOutX: number | null;
  readonly handleOutY: number | null;
  readonly dx: number | null;
  readonly dy: number | null;
}

type AnchorKey = 'x' | 'y';
type HandleKey = 'x' | 'y';

const POINT_TYPE_OPTIONS: readonly { readonly value: AnchorPointType; readonly label: string }[] = [
  { value: 'corner', label: 'Corner' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'symmetric', label: 'Symmetric' },
  { value: 'line', label: 'Line' },
];

@Component({
  selector: 'anchor-options',
  standalone: false,
  templateUrl: './anchor-options.html',
  styleUrl: './anchor-options.scss',
})
export class AnchorOptions {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);

  private readonly selectedAnchors = computed(() => anchorsOfActive(this.session));

  protected readonly showAnchorDelta = computed(() => this.selectedAnchors().length > 1);

  protected readonly pointTypeOptions = POINT_TYPE_OPTIONS;

  protected readonly pointTypeValue = computed(() => sharedPointType(this.selectedAnchors()));

  private readonly anchorDraftSource = computed(() => draftFromAnchors(this.selectedAnchors()), {
    equal: sameAnchorDraft,
  });

  protected readonly anchorDraft = linkedSignal(() => this.anchorDraftSource());
  protected readonly anchorForm = form(this.anchorDraft);

  protected commitPointType(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const pointType = select.value;
    if (!isPointType(pointType)) {
      return;
    }
    const anchors = this.selectedAnchors();
    const objectId = this.session.activeObjectId();
    if (!objectId || anchors.length === 0 || sharedPointType(anchors) === pointType) {
      return;
    }
    this.bus.dispatch({
      type: 'path.setAnchorType',
      objectId,
      anchorIds: anchors.map((anchor) => anchor.id),
      pointType,
    });
  }

  protected commitAnchor(key: AnchorKey, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.anchorDraft()[key];
    const anchors = this.selectedAnchors();
    const objectId = this.session.activeObjectId();
    if (typeof value !== 'number' || !Number.isFinite(value) || !objectId || anchors.length === 0) {
      return;
    }
    if (value === sharedAnchor(anchors, (anchor) => anchor.position[key])) {
      return;
    }
    this.bus.dispatch({
      type: 'path.setAnchor',
      objectId,
      anchorIds: anchors.map((anchor) => anchor.id),
      position: { [key]: value },
    });
  }

  protected commitHandle(slot: 'in' | 'out', key: HandleKey, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const anchors = this.selectedAnchors();
    const objectId = this.session.activeObjectId();
    if (!objectId || anchors.length === 0) {
      return;
    }
    const draft = this.anchorDraft();
    const x = slot === 'in' ? draft.handleInX : draft.handleOutX;
    const y = slot === 'in' ? draft.handleInY : draft.handleOutY;
    const handles = anchors.map((anchor) => (slot === 'in' ? anchor.handleIn : anchor.handleOut));
    if (handles.some((handle) => handle === null)) {
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return;
      }
      this.bus.dispatch({
        type: 'path.setHandle',
        objectId,
        anchorIds: anchors.map((anchor) => anchor.id),
        slot,
        position: { x, y },
        breakLink: true,
      });
      return;
    }
    const value = key === 'x' ? x : y;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value === sharedHandle(handles, key)
    ) {
      return;
    }
    this.bus.dispatch({
      type: 'path.setHandle',
      objectId,
      anchorIds: anchors.map((anchor) => anchor.id),
      slot,
      position: { [key]: value },
      breakLink: true,
    });
  }

  protected commitDelta(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const anchors = this.selectedAnchors();
    const objectId = this.session.activeObjectId();
    const dx = this.anchorDraft().dx;
    const dy = this.anchorDraft().dy;
    if (!objectId || anchors.length < 2) {
      return;
    }
    if (
      typeof dx !== 'number' ||
      typeof dy !== 'number' ||
      !Number.isFinite(dx) ||
      !Number.isFinite(dy)
    ) {
      return;
    }
    if (dx === 0 && dy === 0) {
      return;
    }
    this.bus.dispatch({
      type: 'path.translateAnchors',
      objectId,
      anchorIds: anchors.map((anchor) => anchor.id),
      dx,
      dy,
      gesture: 'begin',
    });
  }
}

function anchorsOfActive(session: SessionService): readonly Anchor[] {
  if (session.mode() !== 'edit') {
    return [];
  }
  const document = session.document();
  const activeId = session.activeObjectId();
  const object = document?.objects.find((item) => item.id === activeId);
  if (!object) {
    return [];
  }
  const selected = new Set(session.selectedAnchorIds());
  const anchors: Anchor[] = [];
  for (const subpath of object.source.subpaths) {
    for (const anchor of subpath.anchors) {
      if (selected.has(anchor.id)) {
        anchors.push(anchor);
      }
    }
  }
  return anchors;
}

function draftFromAnchors(anchors: readonly Anchor[]): AnchorDraft {
  return {
    x: sharedAnchor(anchors, (anchor) => anchor.position.x),
    y: sharedAnchor(anchors, (anchor) => anchor.position.y),
    handleInX: sharedAnchor(anchors, (anchor) => anchor.handleIn?.x ?? null),
    handleInY: sharedAnchor(anchors, (anchor) => anchor.handleIn?.y ?? null),
    handleOutX: sharedAnchor(anchors, (anchor) => anchor.handleOut?.x ?? null),
    handleOutY: sharedAnchor(anchors, (anchor) => anchor.handleOut?.y ?? null),
    dx: 0,
    dy: 0,
  };
}

function sameAnchorDraft(left: AnchorDraft, right: AnchorDraft): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.handleInX === right.handleInX &&
    left.handleInY === right.handleInY &&
    left.handleOutX === right.handleOutX &&
    left.handleOutY === right.handleOutY &&
    left.dx === right.dx &&
    left.dy === right.dy
  );
}

function sharedAnchor<T>(items: readonly Anchor[], read: (anchor: Anchor) => T | null): T | null {
  const first = items[0];
  if (!first) {
    return null;
  }
  const value = read(first);
  if (value === null || items.some((item) => read(item) !== value)) {
    return null;
  }
  return value;
}

function sharedPointType(anchors: readonly Anchor[]): AnchorPointType | 'mixed' | '' {
  const first = anchors[0];
  if (!first) {
    return '';
  }
  const type = anchorPointType(first);
  return anchors.every((anchor) => anchorPointType(anchor) === type) ? type : 'mixed';
}

function isPointType(value: string): value is AnchorPointType {
  return value === 'corner' || value === 'smooth' || value === 'symmetric' || value === 'line';
}

function sharedHandle(handles: readonly Anchor['handleIn'][], key: HandleKey): number | null {
  const first = handles[0];
  if (!first) {
    return null;
  }
  const value = first[key];
  return handles.every((handle) => handle?.[key] === value) ? value : null;
}
