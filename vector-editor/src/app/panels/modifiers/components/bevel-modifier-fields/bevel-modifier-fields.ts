import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Modifier } from '@vector-editor/core';

type BevelModifier = Extract<Modifier, { type: 'bevel' }>;
type BevelJoin = BevelModifier['join'];

interface BevelDraft {
  readonly distance: number | null;
  readonly miterLimit: number | null;
}

export interface BevelModifierPatch {
  readonly distance?: number;
  readonly join?: BevelJoin;
  readonly miterLimit?: number;
}

@Component({
  selector: 'bevel-modifier-fields',
  standalone: false,
  templateUrl: './bevel-modifier-fields.html',
  styleUrl: './bevel-modifier-fields.scss',
})
export class BevelModifierFields {
  readonly modifier = input.required<BevelModifier>();
  readonly committed = output<BevelModifierPatch>();

  private readonly draftSource = computed(
    () => ({
      distance: this.modifier().distance,
      miterLimit: this.modifier().miterLimit,
    }),
    { equal: sameDraft },
  );

  protected readonly draft = linkedSignal(() => this.draftSource());
  protected readonly modifierForm = form(this.draft);

  protected commitDistance(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.draft().distance;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value === this.modifier().distance
    ) {
      return;
    }
    this.committed.emit({ distance: value });
  }

  protected commitMiterLimit(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.draft().miterLimit;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value === this.modifier().miterLimit
    ) {
      return;
    }
    this.committed.emit({ miterLimit: value });
  }

  protected commitJoin(join: BevelJoin): void {
    if (this.modifier().join === join) {
      return;
    }
    this.committed.emit({ join });
  }
}

function sameDraft(left: BevelDraft, right: BevelDraft): boolean {
  return left.distance === right.distance && left.miterLimit === right.miterLimit;
}
