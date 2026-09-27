import { Service, signal } from '@angular/core';
import { ColorSlot } from '@vector-editor/commands';

@Service()
export class ColorTarget {
  readonly slot = signal<ColorSlot>('fill');

  setSlot(slot: ColorSlot): void {
    this.slot.set(slot);
  }
}
