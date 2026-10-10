import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Service, signal } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { imageObjectName, isImageMime } from '@vector-editor/modules/image';
import { ImageMime } from '@vector-editor/modules/types';
import { FileActions } from '../../shell/services/file-actions.service';

export interface ArmedImage {
  readonly fileName: string;
  readonly name: string;
  readonly mime: ImageMime;
  readonly dataUrl: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

@Service()
export class ImagePlace {
  private readonly session = inject(SessionService);
  private readonly files = inject(FileActions);
  private readonly documentRef = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly input: HTMLInputElement;

  readonly armed = signal<ArmedImage | null>(null);

  constructor() {
    const input = this.documentRef.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp';
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
    effect(() => {
      if (this.session.tool() !== 'image') {
        this.armed.set(null);
      }
    });
  }

  requestPick(): void {
    this.input.click();
  }

  arm(image: ArmedImage): void {
    this.armed.set(image);
  }

  private async read(file: File): Promise<void> {
    const mime = mimeOf(file);
    if (!mime) {
      this.files.report('Could not read this image.');
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await readDataUrl(file);
    } catch {
      this.files.report('Could not read this image.');
      return;
    }
    const size = await decodeSize(dataUrl);
    if (!size) {
      this.files.report('Could not read this image.');
      return;
    }
    const comma = dataUrl.indexOf(',');
    const body = comma >= 0 ? dataUrl.slice(comma + 1) : '';
    if (!body) {
      this.files.report('Could not read this image.');
      return;
    }
    this.files.report(null);
    this.armed.set({
      fileName: file.name,
      name: imageObjectName(file.name),
      mime,
      dataUrl: `data:${mime};base64,${body}`,
      pixelWidth: size.width,
      pixelHeight: size.height,
    });
  }
}

function mimeOf(file: File): ImageMime | null {
  if (isImageMime(file.type)) {
    return file.type;
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    });
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function decodeSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : null,
      );
    });
    image.addEventListener('error', () => resolve(null));
    image.src = dataUrl;
  });
}
