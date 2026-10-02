import { Component, input, output } from '@angular/core';
import { Modifier, VectorObject } from '@vector-editor/core';

type MirrorModifier = Extract<Modifier, { type: 'mirror' }>;
type MirrorAxis = MirrorModifier['axis'];

export interface MirrorModifierPatch {
  readonly axis?: MirrorAxis;
  readonly centerPointId?: string | null;
}

@Component({
  selector: 'mirror-modifier-fields',
  standalone: false,
  templateUrl: './mirror-modifier-fields.html',
  styleUrl: './mirror-modifier-fields.scss',
})
export class MirrorModifierFields {
  readonly modifier = input.required<MirrorModifier>();
  readonly emptyPoints = input.required<readonly VectorObject[]>();
  readonly committed = output<MirrorModifierPatch>();

  protected commitAxis(axis: MirrorAxis): void {
    if (this.modifier().axis === axis) {
      return;
    }
    this.committed.emit({ axis });
  }

  protected commitCenterPoint(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const centerPointId = select.value || null;
    if ((this.modifier().centerPointId ?? null) === centerPointId) {
      return;
    }
    this.committed.emit({ centerPointId });
  }
}
