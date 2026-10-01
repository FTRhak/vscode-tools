import { Component, input, output } from '@angular/core';
import { Modifier } from '@vector-editor/core';

type RoundModifier = Extract<Modifier, { type: 'round' }>;

export interface RoundModifierPatch {
  readonly anchorCount?: number;
  readonly roundness?: number;
}

@Component({
  selector: 'round-modifier-fields',
  standalone: false,
  templateUrl: './round-modifier-fields.html',
  styleUrl: './round-modifier-fields.scss',
})
export class RoundModifierFields {
  readonly modifier = input.required<RoundModifier>();
  readonly committed = output<RoundModifierPatch>();

  protected commitAnchorCount(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }
    const anchorCount = Math.max(2, Math.min(1000, Math.floor(value)));
    if (anchorCount !== this.modifier().anchorCount) {
      this.committed.emit({ anchorCount });
    }
  }

  protected commitRoundness(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }
    const roundness = Math.max(0, Math.min(100, value));
    if (roundness !== this.modifier().roundness) {
      this.committed.emit({ roundness });
    }
  }
}