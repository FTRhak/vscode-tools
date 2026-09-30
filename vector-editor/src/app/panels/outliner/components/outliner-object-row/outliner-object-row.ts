import { Component, computed, input, output } from '@angular/core';
import { OutlinerObject } from '../../models';

@Component({
  selector: 'app-outliner-object-row',
  host: {
    class: 'tree-row object-row',
    role: 'treeitem',
    '[class.active]': 'object().active',
    '[attr.aria-selected]': 'object().selected',
    '[attr.aria-level]': '2',
    '[attr.data-tree-key]': 'treeKey()',
    '[tabindex]': 'focused() ? 0 : -1',
    '(click)': 'onClick($event)',
  },
  templateUrl: './outliner-object-row.html',
  styleUrl: './outliner-object-row.scss',
})
export class OutlinerObjectRow {
  readonly object = input.required<OutlinerObject>();
  readonly focused = input(false);

  readonly selected = output<MouseEvent>();
  readonly visibilityToggled = output<Event>();
  readonly lockToggled = output<Event>();

  protected readonly treeKey = computed(() => `object:${this.object().id}`);

  protected onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.selected.emit(event);
  }

  protected toggleVisibility(event: Event): void {
    event.stopPropagation();
    this.visibilityToggled.emit(event);
  }

  protected toggleLock(event: Event): void {
    event.stopPropagation();
    this.lockToggled.emit(event);
  }
}
