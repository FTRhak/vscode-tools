import { Component, computed, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../../commands/command-bus.service';
import { oppositeMode } from '../../commands/command';
import { FileActions } from '../file-actions.service';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);
  private readonly files = inject(FileActions);

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
  protected readonly hasDocument = computed(() => this.session.document() !== null);
  protected readonly status = this.files.status;

  protected toggleMode(): void {
    this.bus.dispatch({
      type: 'session.setMode',
      mode: oppositeMode(this.session.mode()),
    });
  }

  protected newDocument(): void {
    this.files.clearStatus();
    this.bus.dispatch({ type: 'document.new' });
  }

  protected openFile(): void {
    this.files.openPicker();
  }

  protected saveFile(): void {
    this.files.requestSave();
  }

  protected undo(): void {
    this.bus.dispatch({ type: 'history.undo' });
  }

  protected redo(): void {
    this.bus.dispatch({ type: 'history.redo' });
  }
}
