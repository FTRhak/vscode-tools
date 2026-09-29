import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Modifier } from '@vector-editor/core';

type ArrayModifier = Extract<Modifier, { type: 'array' }>;

interface ArrayDraft {
  readonly count: number | null;
  readonly offsetX: number | null;
  readonly offsetY: number | null;
}

export interface ArrayModifierPatch {
  readonly count?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
}

type OffsetKey = 'offsetX' | 'offsetY';

@Component({
  selector: 'array-modifier-fields',
  standalone: false,
  templateUrl: './array-modifier-fields.html',
  styleUrl: './array-modifier-fields.scss',
})
export class ArrayModifierFields {
  readonly modifier = input.required<ArrayModifier>();
  readonly committed = output<ArrayModifierPatch>();

  private readonly draftSource = computed(
    () => ({
      count: this.modifier().count,
      offsetX: this.modifier().offsetX,
      offsetY: this.modifier().offsetY,
    }),
    { equal: sameDraft },
  );

  protected readonly draft = linkedSignal(() => this.draftSource());
  protected readonly arrayForm = form(this.draft);

  protected commitCount(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.draft().count;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return;
    }
    const count = Math.max(1, Math.floor(value));
    if (count === this.modifier().count) {
      return;
    }
    this.committed.emit({ count });
  }

  protected commitOffset(key: OffsetKey, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.draft()[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value === this.modifier()[key]) {
      return;
    }
    this.committed.emit({ [key]: value });
  }
}

function sameDraft(left: ArrayDraft, right: ArrayDraft): boolean {
  return (
    left.count === right.count && left.offsetX === right.offsetX && left.offsetY === right.offsetY
  );
}
