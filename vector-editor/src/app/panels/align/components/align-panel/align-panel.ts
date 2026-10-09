import { Component, computed, inject, signal } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import { AlignEdge, AlignTarget, countAlignable, SessionService } from '@vector-editor/core';
import { SharedModule } from '@vector-editor/shared';

type IconLine = readonly [number, number, number, number];

interface AlignAction {
  readonly edge: AlignEdge;
  readonly label: string;
  readonly lines: readonly IconLine[];
}

@Component({
  selector: 'align-panel',
  imports: [SharedModule],
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
      lines: [
        [2, 1, 2, 15],
        [5, 3, 14, 3],
        [5, 8, 10, 8],
        [5, 13, 12, 13],
      ],
    },
    {
      edge: 'horizontalCenter',
      label: 'Align horizontal center',
      lines: [
        [8, 1, 8, 15],
        [3, 3, 13, 3],
        [5, 8, 11, 8],
        [4, 13, 12, 13],
      ],
    },
    {
      edge: 'right',
      label: 'Align right',
      lines: [
        [14, 1, 14, 15],
        [2, 3, 11, 3],
        [6, 8, 11, 8],
        [4, 13, 11, 13],
      ],
    },
    {
      edge: 'top',
      label: 'Align top',
      lines: [
        [1, 2, 15, 2],
        [3, 5, 3, 14],
        [8, 5, 8, 10],
        [13, 5, 13, 12],
      ],
    },
    {
      edge: 'verticalCenter',
      label: 'Align vertical center',
      lines: [
        [1, 8, 15, 8],
        [3, 3, 3, 13],
        [8, 5, 8, 11],
        [13, 4, 13, 12],
      ],
    },
    {
      edge: 'bottom',
      label: 'Align bottom',
      lines: [
        [1, 14, 15, 14],
        [3, 2, 3, 11],
        [8, 6, 8, 11],
        [13, 4, 13, 11],
      ],
    },
  ];

  protected readonly alignTo = signal<AlignTarget>('selection');

  private readonly selectedIds = computed(() => this.session.selectedObjectIds());

  private readonly alignableCount = computed(() => {
    const document = this.session.document();
    if (!document) {
      return 0;
    }
    return countAlignable(document, this.selectedIds());
  });

  protected readonly canAlign = computed(() => {
    const count = this.alignableCount();
    return this.alignTo() === 'artboard' ? count >= 1 : count >= 2;
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
    if (value === 'selection' || value === 'artboard') {
      this.alignTo.set(value);
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
    });
  }
}
