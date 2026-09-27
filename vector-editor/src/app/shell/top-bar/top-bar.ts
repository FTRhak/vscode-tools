import { Component, computed, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../../commands/command-bus.service';
import { oppositeMode } from '../../commands/command';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);

  protected readonly modeLabel = computed(() =>
    this.session.mode() === 'object' ? 'Object' : 'Edit',
  );

  protected readonly selectionKindLabel = computed(() => {
    if (this.session.mode() !== 'edit') {
      return null;
    }
    return this.session.editSelectionKind() === 'anchor' ? 'Anchors' : 'Segments';
  });

  protected readonly canUndo = this.session.canUndo;
  protected readonly canRedo = this.session.canRedo;

  protected toggleMode(): void {
    this.bus.dispatch({
      type: 'session.setMode',
      mode: oppositeMode(this.session.mode()),
    });
  }

  protected newDocument(): void {
    this.bus.dispatch({ type: 'document.new' });
  }

  protected undo(): void {
    this.bus.dispatch({ type: 'history.undo' });
  }

  protected redo(): void {
    this.bus.dispatch({ type: 'history.redo' });
  }
}
