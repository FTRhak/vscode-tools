import { Component, computed, DestroyRef, effect, ElementRef, inject, signal } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../commands/command-bus.service';
import {
  ARTBOARD_FIT_PADDING,
  cameraTransformAttribute,
  fitArtboard,
  panBy,
  wheelZoomFactor,
  zoomAtPoint,
} from './camera';
import { sceneFromDocument } from './scene';

interface PanGesture {
  readonly pointerId: number;
  readonly fromSpace: boolean;
  readonly originX: number;
  readonly originY: number;
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

@Component({
  selector: 'app-viewport',
  host: {
    tabindex: '0',
    'data-viewport': '',
    'aria-label': 'Canvas',
    '[class.panning]': 'panning()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(keydown)': 'onKeyDown($event)',
    '(keyup)': 'onKeyUp($event)',
    '(blur)': 'onBlur()',
    '(auxclick)': 'onAuxClick($event)',
  },
  templateUrl: './viewport.html',
  styleUrl: './viewport.scss',
})
export class Viewport {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private readonly hostSize = signal({ width: 0, height: 0 });
  private fittedDocumentId: string | null = null;
  private pan: PanGesture | null = null;
  private spaceHeld = false;

  protected readonly panning = signal(false);

  protected readonly scene = computed(() => {
    const document = this.session.document();
    return document ? sceneFromDocument(document) : null;
  });

  protected readonly cameraTransform = computed(() =>
    cameraTransformAttribute(this.session.viewport()),
  );

  constructor() {
    this.watchHostSize();
    this.listenToWheel();
    this.fitNewDocuments();
  }

  protected onPointerDown(event: PointerEvent): void {
    const fromSpace = event.button === 0 && this.spaceHeld;
    const fromMiddle = event.button === 1;
    if (!fromSpace && !fromMiddle) {
      return;
    }
    event.preventDefault();
    const camera = this.session.viewport();
    this.pan = {
      pointerId: event.pointerId,
      fromSpace,
      originX: event.clientX,
      originY: event.clientY,
      panX: camera.panX,
      panY: camera.panY,
      zoom: camera.zoom,
    };
    this.panning.set(true);
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    const pan = this.pan;
    if (!pan || event.pointerId !== pan.pointerId) {
      return;
    }
    if (pan.fromSpace && !this.spaceHeld) {
      this.stopPan();
      return;
    }
    const next = panBy(
      { panX: pan.panX, panY: pan.panY, zoom: pan.zoom },
      event.clientX - pan.originX,
      event.clientY - pan.originY,
    );
    this.bus.dispatch({
      type: 'session.setViewport',
      panX: next.panX,
      panY: next.panY,
      zoom: next.zoom,
    });
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.pan || event.pointerId !== this.pan.pointerId) {
      return;
    }
    this.stopPan();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (!isSpace(event)) {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    this.spaceHeld = true;
  }

  protected onKeyUp(event: KeyboardEvent): void {
    if (!isSpace(event)) {
      return;
    }
    event.preventDefault();
    this.spaceHeld = false;
    if (this.pan?.fromSpace) {
      this.stopPan();
    }
  }

  protected onBlur(): void {
    this.spaceHeld = false;
    if (this.pan?.fromSpace) {
      this.stopPan();
    }
  }

  protected onAuxClick(event: MouseEvent): void {
    if (event.button === 1) {
      event.preventDefault();
    }
  }

  private watchHostSize(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      this.hostSize.set({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private listenToWheel(): void {
    const element = this.host.nativeElement;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const next = zoomAtPoint(
        this.session.viewport(),
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        wheelZoomFactor(event.deltaY, event.deltaMode),
      );
      this.bus.dispatch({
        type: 'session.setViewport',
        panX: next.panX,
        panY: next.panY,
        zoom: next.zoom,
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    this.destroyRef.onDestroy(() => element.removeEventListener('wheel', onWheel));
  }

  private fitNewDocuments(): void {
    effect(() => {
      const document = this.session.document();
      const size = this.hostSize();
      if (!document || size.width <= 0 || size.height <= 0) {
        return;
      }
      if (document.id === this.fittedDocumentId) {
        return;
      }
      this.fittedDocumentId = document.id;
      const camera = fitArtboard(size, document.viewBox, ARTBOARD_FIT_PADDING);
      this.bus.dispatch({
        type: 'session.setViewport',
        panX: camera.panX,
        panY: camera.panY,
        zoom: camera.zoom,
      });
    });
  }

  private stopPan(): void {
    const pan = this.pan;
    this.pan = null;
    this.panning.set(false);
    if (!pan) {
      return;
    }
    const element = this.host.nativeElement;
    if (element.hasPointerCapture?.(pan.pointerId)) {
      element.releasePointerCapture(pan.pointerId);
    }
  }
}

function isSpace(event: KeyboardEvent): boolean {
  return event.key === ' ' || event.code === 'Space';
}
