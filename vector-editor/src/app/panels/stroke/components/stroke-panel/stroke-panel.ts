import { Component, computed, inject, linkedSignal } from '@angular/core';
import { form, max, min } from '@angular/forms/signals';
import { CommandBus } from '@vector-editor/commands';
import { SessionService, VectorObject } from '@vector-editor/core';
import { StrokeDraft } from '../../models';

type NumberField = 'strokeMiterlimit' | 'strokeOpacity' | 'strokeDashoffset';

@Component({
  selector: 'stroke-panel',
  standalone: false,
  templateUrl: './stroke-panel.html',
  styleUrl: './stroke-panel.scss',
})
export class StrokePanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);

  public readonly panelName = 'Stroke';

  private readonly selectedObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const selected = new Set(this.session.selectedObjectIds());
    return document.objects.filter((object) => selected.has(object.id));
  });

  protected readonly hasSelection = computed(() => this.selectedObjects().length > 0);
  protected readonly lineCap = computed(
    () => shared(this.selectedObjects(), (object) => object.style.strokeLinecap) ?? '',
  );
  protected readonly strokeAlign = computed(
    () => shared(this.selectedObjects(), (object) => object.style.strokeAlign) ?? '',
  );
  protected readonly lineJoin = computed(
    () => shared(this.selectedObjects(), (object) => object.style.strokeLinejoin) ?? '',
  );
  private readonly strokeSource = computed(
    (): StrokeDraft => {
      const objects = this.selectedObjects();
      const dashes = sharedDash(objects);
      return {
        strokeWidth: shared(objects, (object) => object.style.strokeWidth),
        strokeMiterlimit: shared(objects, (object) => object.style.strokeMiterlimit),
        strokeOpacity: shared(objects, (object) => object.style.strokeOpacity),
        strokeDashoffset: shared(objects, (object) => object.style.strokeDashoffset),
        strokeDasharray: dashes === undefined || dashes === null ? '' : dashes.join(' '),
      };
    },
    {
      equal: (left, right) =>
        left.strokeWidth === right.strokeWidth &&
        left.strokeMiterlimit === right.strokeMiterlimit &&
        left.strokeOpacity === right.strokeOpacity &&
        left.strokeDashoffset === right.strokeDashoffset &&
        left.strokeDasharray === right.strokeDasharray,
    },
  );

  protected readonly strokeDraft = linkedSignal(() => this.strokeSource());
  protected readonly strokeForm = form(this.strokeDraft, (path) => {
    min(path.strokeOpacity, 0, { message: 'Opacity must be at least 0.' });
    max(path.strokeOpacity, 1, { message: 'Opacity must be at most 1.' });
  });

  protected commitWidth(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.strokeDraft().strokeWidth;
    const objects = this.selectedObjects();
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || objects.length === 0) {
      return;
    }
    if (value === shared(objects, (object) => object.style.strokeWidth)) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      strokeWidth: value,
    });
  }

  protected commitLinecap(event: Event): void {
    const value = choice(event, ['butt', 'round', 'square'] as const);
    const objects = this.selectedObjects();
    if (value === undefined || objects.length === 0) {
      return;
    }
    if (value === shared(objects, (object) => object.style.strokeLinecap)) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      strokeLinecap: value,
    });
  }

  protected commitStrokeAlign(event: Event): void {
    const value = choice(event, ['default', 'inside', 'outside'] as const);
    const objects = this.selectedObjects();
    if (value === undefined || objects.length === 0) {
      return;
    }
    if (value === shared(objects, (object) => object.style.strokeAlign)) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      strokeAlign: value,
    });
  }

  protected commitLinejoin(event: Event): void {
    const value = choice(event, ['miter', 'round', 'bevel'] as const);
    const objects = this.selectedObjects();
    if (value === undefined || objects.length === 0) {
      return;
    }
    if (value === shared(objects, (object) => object.style.strokeLinejoin)) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      strokeLinejoin: value,
    });
  }

  protected commitNumber(field: NumberField, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.strokeDraft()[field];
    const objects = this.selectedObjects();
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !acceptsNumber(field, value) ||
      objects.length === 0
    ) {
      return;
    }
    if (value === shared(objects, (object) => object.style[field])) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      [field]: value,
    });
  }

  protected commitDash(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const text = this.strokeDraft().strokeDasharray;
    const objects = this.selectedObjects();
    if (objects.length === 0 || text === this.strokeSource().strokeDasharray) {
      return;
    }
    const value = parseDash(text);
    if (value === undefined) {
      return;
    }
    const current = sharedDash(objects);
    if (current !== undefined && sameDash(current, value)) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      strokeDasharray: value,
    });
  }
}

function choice<T extends string>(event: Event, allowed: readonly T[]): T | undefined {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) {
    return undefined;
  }
  return allowed.find((item) => item === select.value);
}

function acceptsNumber(field: NumberField, value: number): boolean {
  if (field === 'strokeMiterlimit') {
    return value >= 1;
  }
  if (field === 'strokeOpacity') {
    return value >= 0 && value <= 1;
  }
  return true;
}

function parseDash(text: string): readonly number[] | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  const numbers = trimmed
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
    .map((part) => Number(part));
  if (numbers.length === 0 || numbers.some((length) => !Number.isFinite(length) || length < 0)) {
    return undefined;
  }
  return numbers;
}

function sharedDash(items: readonly VectorObject[]): readonly number[] | null | undefined {
  const first = items[0];
  if (!first) {
    return undefined;
  }
  const value = first.style.strokeDasharray;
  return items.every((item) => sameDash(item.style.strokeDasharray, value)) ? value : undefined;
}

function sameDash(left: readonly number[] | null, right: readonly number[] | null): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null || left.length !== right.length) {
    return false;
  }
  return left.every((length, index) => length === right[index]);
}

function shared<T>(items: readonly VectorObject[], read: (object: VectorObject) => T): T | null {
  const first = items[0];
  if (!first) {
    return null;
  }
  const value = read(first);
  return items.every((item) => read(item) === value) ? value : null;
}
