import { Component, computed, inject, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Anchor, ObjectTransform, SessionService, VectorObject } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { SharedModule } from '@vector-editor/shared';

type TransformKey = keyof ObjectTransform;

interface OptionsDraft {
  readonly name: string;
  readonly x: number | null;
  readonly y: number | null;
  readonly rotation: number | null;
  readonly scaleX: number | null;
  readonly scaleY: number | null;
}

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

@Component({
  selector: 'app-options-panel',
  imports: [FormField, SharedModule],
  templateUrl: './options-panel.html',
  styleUrl: './options-panel.scss',
})
export class OptionsPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);

  public readonly panelName = 'Options';

  private readonly selectedObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const selected = new Set(this.session.selectedObjectIds());
    return document.objects.filter((object) => selected.has(object.id));
  });

  protected readonly showObjectOptions = computed(
    () => this.session.mode() === 'object' && this.selectedObjects().length > 0,
  );

  private readonly selectedAnchors = computed(() => anchorsOfActive(this.session));

  protected readonly showAnchorOptions = computed(() => this.selectedAnchors().length > 0);

  protected readonly showAnchorDelta = computed(() => this.selectedAnchors().length > 1);

  private readonly activeObject = computed(() => {
    const objects = this.selectedObjects();
    const activeId = this.session.activeObjectId();
    return objects.find((object) => object.id === activeId) ?? objects[0] ?? null;
  });

  protected readonly layerName = computed(() => {
    const document = this.session.document();
    const object = this.activeObject();
    if (!document || !object) {
      return '';
    }
    return document.layers.find((layer) => layer.id === object.layerId)?.name ?? '';
  });

  protected readonly subpathCount = computed(
    () => this.activeObject()?.source.subpaths.length ?? 0,
  );

  protected readonly anchorCount = computed(() => {
    const object = this.activeObject();
    if (!object) {
      return 0;
    }
    return object.source.subpaths.reduce((sum, subpath) => sum + subpath.anchors.length, 0);
  });

  protected readonly visibleState = computed(() =>
    shared(this.selectedObjects(), (object) => object.visible),
  );

  protected readonly lockedState = computed(() =>
    shared(this.selectedObjects(), (object) => object.locked),
  );

  private readonly draftSource = computed(() => draftFrom(this.selectedObjects()), {
    equal: sameDraft,
  });

  protected readonly draft = linkedSignal(() => this.draftSource());
  protected readonly optionsForm = form(this.draft);

  private readonly anchorDraftSource = computed(() => draftFromAnchors(this.selectedAnchors()), {
    equal: sameAnchorDraft,
  });

  protected readonly anchorDraft = linkedSignal(() => this.anchorDraftSource());
  protected readonly anchorForm = form(this.anchorDraft);

  protected commitName(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const name = this.draft().name.trim();
    const objects = this.selectedObjects();
    if (!name || objects.length === 0 || name === shared(objects, (object) => object.name)) {
      return;
    }
    this.bus.dispatch({
      type: 'object.setFlags',
      ids: objects.map((object) => object.id),
      name,
    });
  }

  protected commitNumber(key: TransformKey, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.draft()[key];
    const objects = this.selectedObjects();
    if (typeof value !== 'number' || !Number.isFinite(value) || objects.length === 0) {
      return;
    }
    if (value === shared(objects, (object) => object.transform[key])) {
      return;
    }
    this.bus.dispatch({
      type: 'object.setTransform',
      ids: objects.map((object) => object.id),
      transform: { [key]: value },
    });
  }

  protected commitFlag(flag: 'visible' | 'locked', event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const objects = this.selectedObjects();
    if (objects.length === 0) {
      return;
    }
    this.bus.dispatch({
      type: 'object.setFlags',
      ids: objects.map((object) => object.id),
      [flag]: input.checked,
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

function draftFrom(objects: readonly VectorObject[]): OptionsDraft {
  return {
    name: shared(objects, (object) => object.name) ?? '',
    x: shared(objects, (object) => object.transform.x),
    y: shared(objects, (object) => object.transform.y),
    rotation: shared(objects, (object) => object.transform.rotation),
    scaleX: shared(objects, (object) => object.transform.scaleX),
    scaleY: shared(objects, (object) => object.transform.scaleY),
  };
}

function sameDraft(left: OptionsDraft, right: OptionsDraft): boolean {
  return (
    left.name === right.name &&
    left.x === right.x &&
    left.y === right.y &&
    left.rotation === right.rotation &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY
  );
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

function sharedHandle(handles: readonly Anchor['handleIn'][], key: HandleKey): number | null {
  const first = handles[0];
  if (!first) {
    return null;
  }
  const value = first[key];
  return handles.every((handle) => handle?.[key] === value) ? value : null;
}

function shared<T>(items: readonly VectorObject[], read: (object: VectorObject) => T): T | null {
  const first = items[0];
  if (!first) {
    return null;
  }
  const value = read(first);
  return items.every((item) => read(item) === value) ? value : null;
}
