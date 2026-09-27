import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Service, signal } from '@angular/core';
import { exportSvg, importSvg, SaveMode, SessionService } from '@vector-editor/core';
import { CommandBus } from '../commands/command-bus.service';

@Service()
export class FileActions {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);
  private readonly documentRef = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly input: HTMLInputElement;
  private requestId = 0;

  readonly saveDialogOpen = signal(false);
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
    this.restoreFocus();
  }

  confirmSave(mode: SaveMode): void {
    const current = this.session.document();
    this.saveDialogOpen.set(false);
    if (current) {
      downloadSvg(this.documentRef, exportSvg(current, mode), fileName(current.name));
    }
    this.restoreFocus();
  }

  clearStatus(): void {
    this.status.set(null);
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

  private restoreFocus(): void {
    const button = this.documentRef.querySelector('[data-file-save]');
    if (button instanceof HTMLElement) {
      button.focus();
    }
  }
}

function downloadSvg(documentRef: Document, contents: string, name: string): void {
  const blob = new Blob([contents], { type: 'image/svg+xml' });
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
