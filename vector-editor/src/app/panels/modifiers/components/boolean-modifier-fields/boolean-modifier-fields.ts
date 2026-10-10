import { Component, input, output } from '@angular/core';
import { Modifier, VectorObject } from '@vector-editor/modules/types/types';

type BooleanModifier = Extract<Modifier, { type: 'boolean' }>;
type BooleanOperation = BooleanModifier['operation'];

export interface BooleanModifierPatch {
  readonly operation?: BooleanOperation;
  readonly operandId?: string;
}

@Component({
  selector: 'boolean-modifier-fields',
  standalone: false,
  templateUrl: './boolean-modifier-fields.html',
  styleUrl: './boolean-modifier-fields.scss',
})
export class BooleanModifierFields {
  readonly modifier = input.required<BooleanModifier>();
  readonly peers = input.required<readonly VectorObject[]>();
  readonly committed = output<BooleanModifierPatch>();

  protected commitOperation(operation: BooleanOperation): void {
    if (this.modifier().operation === operation) {
      return;
    }
    this.committed.emit({ operation });
  }

  protected commitOperand(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    if (this.modifier().operandId === select.value) {
      return;
    }
    this.committed.emit({ operandId: select.value });
  }
}
