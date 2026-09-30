import { Component, input, output } from '@angular/core';
import { OutlinerLayer } from '../../models';

@Component({
  selector: 'app-outliner-layer-row',
  host: {
    class: 'tree-row layer-row',
    '[class.selected]': 'layer().selected',
    '(click)': 'onClick()',
  },
  templateUrl: './outliner-layer-row.html',
  styleUrl: './outliner-layer-row.scss',
})
export class OutlinerLayerRow {
  readonly layer = input.required<OutlinerLayer>();

  readonly selected = output<void>();
  readonly expandedToggled = output<Event>();
  readonly visibilityToggled = output<Event>();
  readonly lockToggled = output<Event>();
  readonly renamed = output<Event>();
  readonly movedForward = output<Event>();
  readonly movedBackward = output<Event>();

  protected onClick(): void {
    this.selected.emit();
  }

  protected toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expandedToggled.emit(event);
  }

  protected toggleVisibility(event: Event): void {
    event.stopPropagation();
    this.visibilityToggled.emit(event);
  }

  protected toggleLock(event: Event): void {
    event.stopPropagation();
    this.lockToggled.emit(event);
  }

  protected rename(event: Event): void {
    event.stopPropagation();
    this.renamed.emit(event);
  }

  protected moveForward(event: Event): void {
    event.stopPropagation();
    this.movedForward.emit(event);
  }

  protected moveBackward(event: Event): void {
    event.stopPropagation();
    this.movedBackward.emit(event);
  }
}
