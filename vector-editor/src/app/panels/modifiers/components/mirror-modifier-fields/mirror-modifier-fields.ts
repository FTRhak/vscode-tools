import { Component, input, output } from '@angular/core';
import { Modifier } from '@vector-editor/core';

type MirrorModifier = Extract<Modifier, { type: 'mirror' }>;
type MirrorAxis = MirrorModifier['axis'];

export interface MirrorModifierPatch {
  readonly axis: MirrorAxis;
}

@Component({
  selector: 'mirror-modifier-fields',
  templateUrl: './mirror-modifier-fields.html',
  styleUrl: './mirror-modifier-fields.scss',
})
export class MirrorModifierFields {
  readonly modifier = input.required<MirrorModifier>();
  readonly committed = output<MirrorModifierPatch>();

  protected commitAxis(axis: MirrorAxis): void {
    if (this.modifier().axis === axis) {
      return;
    }
    this.committed.emit({ axis });
  }
}
