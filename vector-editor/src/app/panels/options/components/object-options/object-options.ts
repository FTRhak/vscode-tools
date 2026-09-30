import { Component, computed, inject, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CommandBus } from '@vector-editor/commands';
import {
  Document,
  isInteractionLocked,
  ObjectTransform,
  rotationOriginDocument,
  SessionService,
  VectorObject,
} from '@vector-editor/core';

type TransformKey = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY';
type PivotAxis = 'x' | 'y';

interface OptionsDraft {
  readonly name: string;
  readonly x: number | null;
  readonly y: number | null;
  readonly rotation: number | null;
  readonly pivotX: number | null;
  readonly pivotY: number | null;
  readonly scaleX: number | null;
  readonly scaleY: number | null;
}

@Component({
  selector: 'object-options',
  standalone: false,
  templateUrl: './object-options.html',
  styleUrl: './object-options.scss',
})
export class ObjectOptions {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);

  private readonly selectedObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const selected = new Set(this.session.selectedObjectIds());
    return document.objects.filter((object) => selected.has(object.id));
  });

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

  protected readonly canApplyTransform = computed(() => {
    const document = this.session.document();
    const object = this.activeObject();
    return !!document && !!object && hasEditableTransform(document, object);
  });

  private readonly resettableObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    return this.selectedObjects().filter((object) => hasEditableTransform(document, object));
  });

  protected readonly canResetTransform = computed(() => this.resettableObjects().length > 0);

  private readonly draftSource = computed(() => draftFrom(this.selectedObjects()), {
    equal: sameDraft,
  });

  protected readonly draft = linkedSignal(() => this.draftSource());
  protected readonly optionsForm = form(this.draft);

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

  protected commitPivot(axis: PivotAxis, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = axis === 'x' ? this.draft().pivotX : this.draft().pivotY;
    const objects = this.selectedObjects();
    if (typeof value !== 'number' || !Number.isFinite(value) || objects.length === 0) {
      return;
    }
    if (value === shared(objects, (object) => rotationOriginDocument(object.transform)[axis])) {
      return;
    }
    this.bus.dispatch({
      type: 'object.setRotationOrigin',
      ids: objects.map((object) => object.id),
      [axis]: value,
    });
  }

  protected applyTransform(): void {
    const object = this.activeObject();
    if (!object || !this.canApplyTransform()) {
      return;
    }
    this.bus.dispatch({ type: 'object.applyTransform', id: object.id });
  }

  protected resetTransform(): void {
    const objects = this.resettableObjects();
    if (objects.length === 0) {
      return;
    }
    this.bus.dispatch({
      type: 'object.setTransform',
      ids: objects.map((object) => object.id),
      transform: identityTransform,
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
}

const identityTransform: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  originX: 0,
  originY: 0,
};

function hasEditableTransform(document: Document, object: VectorObject): boolean {
  if (isInteractionLocked(document, object)) {
    return false;
  }
  const transform = object.transform;
  return (Object.keys(identityTransform) as (keyof ObjectTransform)[]).some(
    (key) => transform[key] !== identityTransform[key],
  );
}

function draftFrom(objects: readonly VectorObject[]): OptionsDraft {
  return {
    name: shared(objects, (object) => object.name) ?? '',
    x: shared(objects, (object) => object.transform.x),
    y: shared(objects, (object) => object.transform.y),
    rotation: shared(objects, (object) => object.transform.rotation),
    pivotX: shared(objects, (object) => rotationOriginDocument(object.transform).x),
    pivotY: shared(objects, (object) => rotationOriginDocument(object.transform).y),
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
    left.pivotX === right.pivotX &&
    left.pivotY === right.pivotY &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY
  );
}

function shared<T>(items: readonly VectorObject[], read: (object: VectorObject) => T): T | null {
  const first = items[0];
  if (!first) {
    return null;
  }
  const value = read(first);
  return items.every((item) => read(item) === value) ? value : null;
}
