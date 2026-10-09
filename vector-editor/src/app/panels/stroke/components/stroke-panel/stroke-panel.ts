import { Component, computed, inject, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CommandBus } from '@vector-editor/commands';
import { SessionService, VectorObject } from '@vector-editor/core';
import { SharedModule } from '@vector-editor/shared';

interface WidthDraft {
  readonly strokeWidth: number | null;
}

@Component({
  selector: 'stroke-panel',
  imports: [SharedModule, FormField],
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
  private readonly widthSource = computed(
    (): WidthDraft => ({
      strokeWidth: shared(this.selectedObjects(), (object) => object.style.strokeWidth),
    }),
    { equal: (left, right) => left.strokeWidth === right.strokeWidth },
  );

  protected readonly widthDraft = linkedSignal(() => this.widthSource());
  protected readonly widthForm = form(this.widthDraft);

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
}

function shared<T>(items: readonly VectorObject[], read: (object: VectorObject) => T): T | null {
  const first = items[0];
  if (!first) {
    return null;
  }
  const value = read(first);
  return items.every((item) => read(item) === value) ? value : null;
}
