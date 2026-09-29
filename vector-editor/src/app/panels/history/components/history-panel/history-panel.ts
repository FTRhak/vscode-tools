import { CdkListbox, CdkOption } from '@angular/cdk/listbox';
import { afterRenderEffect, Component, computed, ElementRef, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { SharedModule } from '@vector-editor/shared';

interface HistoryRow {
  readonly index: number;
  readonly label: string;
  readonly future: boolean;
}

@Component({
  imports: [SharedModule, CdkListbox, CdkOption],
  selector: 'app-history-panel',
  templateUrl: './history-panel.html',
  styleUrl: './history-panel.scss',
})
export class HistoryPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);
  private readonly host = inject(ElementRef<HTMLElement>);

  public readonly panelName = 'History';

  protected readonly rows = computed((): readonly HistoryRow[] => {
    const history = this.session.history();
    return history.entries.map((entry, index) => ({
      index,
      label: entry.label,
      future: index > history.index,
    }));
  });

  protected readonly selection = computed((): readonly number[] => {
    const index = this.session.history().index;
    return index < 0 ? [] : [index];
  });

  constructor() {
    afterRenderEffect({
      mixedReadWrite: () => {
        const index = this.session.history().index;
        if (index < 0) {
          return;
        }
        const current = this.host.nativeElement.querySelector('[aria-selected="true"]');
        current?.scrollIntoView({ block: 'nearest' });
      },
    });
  }

  protected jump(index: number | undefined): void {
    if (index === undefined || index === this.session.history().index) {
      return;
    }
    this.bus.dispatch({ type: 'history.jump', index });
  }
}
