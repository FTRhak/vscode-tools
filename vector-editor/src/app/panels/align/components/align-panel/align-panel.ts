import { Component, computed, inject, signal } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import { AlignEdge, AlignTarget, canAlignObjects, SessionService } from '@vector-editor/core';
import { AlignAction } from '../../models';

@Component({
  selector: 'align-panel',
  standalone: false,
  templateUrl: './align-panel.html',
  styleUrl: './align-panel.scss',
})
export class AlignPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);

  public readonly panelName = 'Align';

  protected readonly actions: readonly AlignAction[] = [
    {
      edge: 'left',
      label: 'Align left',
      icon: '&#xe10c;',
    },
    {
      edge: 'horizontalCenter',
      label: 'Align horizontal center',
      icon: '&#xe10b;',
    },
    {
      edge: 'right',
      label: 'Align right',
      icon: '&#xe10d;',
    },
    {
      edge: 'top',
      label: 'Align top',
      icon: '&#xe10f;',
    },
    {
      edge: 'verticalCenter',
      label: 'Align vertical center',
      icon: '&#xe10e;',
    },
    {
      edge: 'bottom',
      label: 'Align bottom',
      icon: '&#xe110;',
    },
  ];

  protected readonly alignTo = signal<AlignTarget>('selection');
  protected readonly applyTransformation = signal(false);

  private readonly selectedIds = computed(() => this.session.selectedObjectIds());

  protected readonly canAlign = computed(() => {
    const document = this.session.document();
    if (!document) {
      return false;
    }
    return canAlignObjects(document, this.selectedIds(), this.alignTo());
  });

  protected readonly hint = computed((): string | null => {
    if (this.selectedIds().length === 0) {
      return 'Nothing selected.';
    }
    if (!this.canAlign()) {
      return 'Select two or more objects.';
    }
    return null;
  });

  protected setAlignTo(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    if (value === 'selection' || value === 'artboard' || value === 'first') {
      this.alignTo.set(value);
    }
  }

  protected setApplyTransformation(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.applyTransformation.set(input.checked);
    }
  }

  protected align(edge: AlignEdge): void {
    if (!this.canAlign()) {
      return;
    }
    this.bus.dispatch({
      type: 'object.align',
      ids: this.selectedIds(),
      edge,
      to: this.alignTo(),
      applyTransform: this.applyTransformation(),
    });
  }
}
