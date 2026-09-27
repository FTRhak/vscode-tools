import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, effect, inject, signal } from '@angular/core';
import { SaveMode } from '@vector-editor/core';
import { FileActions } from '../file-actions.service';

@Component({
  selector: 'app-save-dialog',
  imports: [CdkTrapFocus],
  templateUrl: './save-dialog.html',
  styleUrl: './save-dialog.scss',
})
export class SaveDialog {
  private readonly files = inject(FileActions);
  protected readonly open = this.files.saveDialogOpen;
  protected readonly mode = signal<SaveMode>('all');

  constructor() {
    effect(() => {
      if (this.files.saveDialogOpen()) {
        this.mode.set('all');
      }
    });
  }

  protected choose(mode: SaveMode): void {
    this.mode.set(mode);
  }

  protected confirm(): void {
    this.files.confirmSave(this.mode());
  }

  protected cancel(): void {
    this.files.cancelSave();
  }
}
