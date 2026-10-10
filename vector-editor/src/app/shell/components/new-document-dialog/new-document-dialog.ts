import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, effect, inject, signal } from '@angular/core';
import { FormField, form, min, required } from '@angular/forms/signals';
import { defaultDocumentHeight, defaultDocumentWidth } from '@vector-editor/modules/create-document';
import { FileActions } from '../../services/file-actions.service';

interface SizeDraft {
  width: number | null;
  height: number | null;
}

@Component({
  selector: 'app-new-document-dialog',
  imports: [CdkTrapFocus, FormField],
  templateUrl: './new-document-dialog.html',
  styleUrl: './new-document-dialog.scss',
})
export class NewDocumentDialog {
  private readonly files = inject(FileActions);
  protected readonly open = this.files.newDialogOpen;
  protected readonly submitted = signal(false);
  protected readonly size = signal<SizeDraft>({
    width: defaultDocumentWidth,
    height: defaultDocumentHeight,
  });
  protected readonly sizeForm = form(this.size, (path) => {
    required(path.width, { message: 'Enter a width.' });
    min(path.width, 1, { message: 'Width must be at least 1.' });
    required(path.height, { message: 'Enter a height.' });
    min(path.height, 1, { message: 'Height must be at least 1.' });
  });

  constructor() {
    effect(() => {
      if (this.files.newDialogOpen()) {
        this.submitted.set(false);
        this.size.set({ width: defaultDocumentWidth, height: defaultDocumentHeight });
      }
    });
  }

  protected fieldError(field: 'width' | 'height'): string | null {
    if (!this.submitted()) {
      return null;
    }
    return this.sizeForm[field]().errors()[0]?.message ?? null;
  }

  protected confirm(): void {
    this.submitted.set(true);
    const { width, height } = this.size();
    if (this.sizeForm().invalid() || width === null || height === null) {
      return;
    }
    this.files.confirmNew(width, height);
  }

  protected cancel(): void {
    this.files.cancelNew();
  }
}
