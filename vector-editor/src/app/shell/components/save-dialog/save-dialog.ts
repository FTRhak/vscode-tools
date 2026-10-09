import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, effect, inject, signal } from '@angular/core';
import { ImageLocation, SaveMode } from '@vector-editor/core';
import { FileActions } from '../../services/file-actions.service';

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
  protected readonly images = signal<ImageLocation>('preserve');

  constructor() {
    effect(() => {
      if (this.files.saveDialogOpen()) {
        this.mode.set('all');
        this.images.set('preserve');
      }
    });
  }

  protected choose(mode: SaveMode): void {
    this.mode.set(mode);
  }

  protected chooseImages(images: ImageLocation): void {
    this.images.set(images);
  }

  protected confirm(): void {
    this.files.confirmSave(this.mode(), this.images());
  }

  protected cancel(): void {
    this.files.cancelSave();
  }
}
