import { Component, input, output } from '@angular/core';
import { Modifier, VectorObject } from '@vector-editor/modules/types/types';

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

  protected toggleAxis(axis: 'x' | 'y'): void {
    const currentAxis = this.modifier().axis;
    const hasX = currentAxis === 'x' || currentAxis === 'xy';
    const hasY = currentAxis === 'y' || currentAxis === 'xy';
    const nextX = axis === 'x' ? !hasX : hasX;
    const nextY = axis === 'y' ? !hasY : hasY;
    const nextAxis: MirrorAxis = nextX ? (nextY ? 'xy' : 'x') : nextY ? 'y' : 'none';
    this.committed.emit({ axis: nextAxis });
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
