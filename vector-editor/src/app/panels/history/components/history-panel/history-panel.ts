import { afterRenderEffect, Component, computed, ElementRef, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { SharedModule } from '@vector-editor/shared';

interface HistoryRow {
  readonly index: number;
  readonly label: string;
  readonly current: boolean;
  readonly future: boolean;
}

@Component({
  imports: [SharedModule],
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
      current: index === history.index,
      future: index > history.index,
    }));
  });

  constructor() {
    afterRenderEffect({
      mixedReadWrite: () => {
        const index = this.session.history().index;
        if (index < 0) {
          return;
        }
        const current = this.host.nativeElement.querySelector('[aria-current="step"]');
        current?.scrollIntoView({ block: 'nearest' });
      },
    });
  }

  protected jump(index: number): void {
    if (index === this.session.history().index) {
      return;
    }
    this.bus.dispatch({ type: 'history.jump', index });
  }
}
