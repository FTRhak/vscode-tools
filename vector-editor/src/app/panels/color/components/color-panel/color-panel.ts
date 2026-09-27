import { Component, computed, inject, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ColorSlot } from '@vector-editor/commands/command';
import { CommandBus } from '@vector-editor/commands/command-bus.service';
import { SessionService, VectorObject } from '@vector-editor/core';
import { SharedModule } from '@vector-editor/shared';
import { ColorTarget } from '../../services/color-target';

interface WidthDraft {
  readonly strokeWidth: number | null;
}

type SharedColor =
  | { readonly kind: 'color'; readonly value: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'mixed' };

@Component({
  selector: 'app-color-panel',
  imports: [FormField, SharedModule],
  templateUrl: './color-panel.html',
  styleUrl: './color-panel.scss',
})
export class ColorPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);
  private readonly colorTarget = inject(ColorTarget);

  public readonly panelName = 'Color';

  private readonly selectedObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const selected = new Set(this.session.selectedObjectIds());
    return document.objects.filter((object) => selected.has(object.id));
  });

  protected readonly hasSelection = computed(() => this.selectedObjects().length > 0);
  protected readonly slot = this.colorTarget.slot;
  protected readonly fillColor = computed(() => sharedColor(this.selectedObjects(), 'fill'));
  protected readonly strokeColor = computed(() => sharedColor(this.selectedObjects(), 'stroke'));
  protected readonly activeColor = computed(() =>
    this.slot() === 'fill' ? this.fillColor() : this.strokeColor(),
  );
  protected readonly pickerValue = computed(() => {
    const active = this.activeColor();
    return active.kind === 'color' ? active.value : '#000000';
  });

  private readonly widthSource = computed(
    (): WidthDraft => ({
      strokeWidth: shared(this.selectedObjects(), (object) => object.style.strokeWidth),
    }),
    { equal: (left, right) => left.strokeWidth === right.strokeWidth },
  );

  protected readonly widthDraft = linkedSignal(() => this.widthSource());
  protected readonly widthForm = form(this.widthDraft);

  protected chipBackground(color: SharedColor): string | null {
    return color.kind === 'color' ? color.value : null;
  }

  protected chooseSlot(slot: ColorSlot): void {
    this.colorTarget.setSlot(slot);
  }

  protected commitColor(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    this.writeActive(input.value);
  }

  protected clearActive(): void {
    const objects = this.selectedObjects();
    const slot = this.slot();
    if (objects.length === 0 || objects.every((object) => object.style[slot] === null)) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      [slot]: null,
    });
  }

  protected commitWidth(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.widthDraft().strokeWidth;
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

  private writeActive(color: string): void {
    const objects = this.selectedObjects();
    const slot = this.slot();
    if (objects.length === 0) {
      return;
    }
    const current = shared(objects, (object) => object.style[slot]);
    if (current === color.toLowerCase()) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      [slot]: color,
    });
  }
}

function sharedColor(objects: readonly VectorObject[], slot: ColorSlot): SharedColor {
  const first = objects[0];
  if (!first) {
    return { kind: 'none' };
  }
  const value = first.style[slot];
  if (objects.some((object) => object.style[slot] !== value)) {
    return { kind: 'mixed' };
  }
  return value === null ? { kind: 'none' } : { kind: 'color', value };
}

function shared<T>(items: readonly VectorObject[], read: (object: VectorObject) => T): T | null {
  const first = items[0];
  if (!first) {
    return null;
  }
  const value = read(first);
  return items.every((item) => read(item) === value) ? value : null;
}
