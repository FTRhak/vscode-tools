import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Service, signal } from '@angular/core';
import { exportSvg, ImageLocation, importSvg, SaveMode, SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';

@Service()
export class FileActions {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);
  private readonly documentRef = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly input: HTMLInputElement;
  private requestId = 0;

  readonly saveDialogOpen = signal(false);
  readonly newDialogOpen = signal(false);
  readonly status = signal<string | null>(null);

  constructor() {
    const input = this.documentRef.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.hidden = true;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) {
        void this.read(file);
      }
    });
    this.documentRef.body.append(input);
    this.input = input;
    this.destroyRef.onDestroy(() => input.remove());
  }

  openPicker(): void {
    this.input.click();
  }

  requestSave(): void {
    if (!this.session.document()) {
      return;
    }
    this.saveDialogOpen.set(true);
  }

  cancelSave(): void {
    this.saveDialogOpen.set(false);
    this.restoreFocus('[data-file-save]');
  }

  confirmSave(mode: SaveMode, images: ImageLocation = 'preserve'): void {
    const current = this.session.document();
    this.saveDialogOpen.set(false);
    if (current) {
      const exported = exportSvg(current, mode, images);
      downloadBlob(this.documentRef, new Blob([exported.svg], { type: 'image/svg+xml' }), fileName(current.name));
      for (const file of exported.files) {
        const bytes = Uint8Array.from(file.bytes);
        downloadBlob(this.documentRef, new Blob([bytes], { type: file.mime }), file.name);
      }
      if (exported.files.length > 0) {
        this.status.set('Save the image files next to the SVG.');
      }
    }
    this.restoreFocus('[data-file-save]');
  }

  requestNew(): void {
    this.status.set(null);
    this.newDialogOpen.set(true);
  }

  cancelNew(): void {
    this.newDialogOpen.set(false);
    this.restoreFocus('[data-file-new]');
  }

  confirmNew(width: number, height: number): void {
    this.newDialogOpen.set(false);
    this.bus.dispatch({ type: 'document.new', width, height });
    this.restoreFocus('[data-file-new]');
  }

  clearStatus(): void {
    this.status.set(null);
  }

  report(message: string | null): void {
    this.status.set(message);
  }

  private async read(file: File): Promise<void> {
    const requestId = ++this.requestId;
    let text: string;
    try {
      text = await file.text();
    } catch {
      if (requestId === this.requestId) {
        this.status.set('Could not read this SVG.');
      }
      return;
    }
    if (requestId !== this.requestId) {
      return;
    }
    const result = importSvg(text);
    if (!result.ok) {
      this.status.set('Could not read this SVG.');
      return;
    }
    this.bus.dispatch({ type: 'document.replace', document: result.document });
    this.status.set(result.skipped > 0 ? `Skipped ${result.skipped} nodes.` : null);
  }

  private restoreFocus(selector: string): void {
    const button = this.documentRef.querySelector(selector);
    if (button instanceof HTMLElement) {
      button.focus();
    }
  }
}

function downloadBlob(documentRef: Document, blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  documentRef.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function fileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '').trim() || 'Untitled';
  return cleaned.toLowerCase().endsWith('.svg') ? cleaned : `${cleaned}.svg`;
}
