import { Component, computed, inject } from '@angular/core';
import { ColorSlot, CommandBus } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
import { Gradient, VectorObject } from '@vector-editor/modules/types/types';
import { gradientBackground } from '../../../../viewport/utils/scene';
import { ColorTarget } from '../../services/color-target';

type SharedColor =
  | { readonly kind: 'color'; readonly value: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'mixed' };

@Component({
  selector: 'color-panel',
  standalone: false,
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
  protected readonly gradients = computed(() => this.session.document()?.gradients ?? []);
  protected readonly slot = this.colorTarget.slot;
  protected readonly fillColor = computed(() => sharedColor(this.selectedObjects(), 'fill'));
  protected readonly strokeColor = computed(() => sharedColor(this.selectedObjects(), 'stroke'));
  protected readonly activeColor = computed(() =>
    this.slot() === 'fill' ? this.fillColor() : this.strokeColor(),
  );
  protected readonly pickerValue = computed(() => {
    const active = this.activeColor();
    return active.kind === 'color' && /^#[0-9a-f]{6}$/i.test(active.value)
      ? active.value
      : '#000000';
  });

  protected chipBackground(color: SharedColor): string | null {
    if (color.kind !== 'color') {
      return null;
    }
    const id = /^url\(#(.+)\)$/.exec(color.value)?.[1];
    const gradient = this.gradients().find((item) => item.id === id);
    return gradient ? this.gradientBackground(gradient) : color.value;
  }

  protected gradientBackground(gradient: Gradient): string {
    return gradientBackground(gradient);
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
