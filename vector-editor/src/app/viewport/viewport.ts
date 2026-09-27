import { Component, computed, DestroyRef, effect, ElementRef, inject, signal } from '@angular/core';
import { CommandBus, TranslateGesture } from '@vector-editor/commands';
import { isInteractionLocked, SessionService, Vec2, VectorObject } from '@vector-editor/core';
import { anchorsInRect } from './anchor-hit';
import {
  ARTBOARD_FIT_PADDING,
  cameraTransformAttribute,
  fitArtboard,
  panBy,
  screenToDocument,
  wheelZoomFactor,
  zoomAtPoint,
} from './camera';
import { DocumentRect, documentToLocal, hitTestObject, objectsInRect } from './hit-test';
import { formatObjectTransform, sceneFromDocument } from './scene';
import {
  beginDirectDrag,
  DirectDrag,
  finishDirectDrag,
  updateDirectDrag,
} from './tools/direct-select';
import { PenDrag, penPreviewData, startPen, updatePenDrag } from './tools/pen';

interface PanGesture {
  readonly pointerId: number;
  readonly fromSpace: boolean;
  readonly originX: number;
  readonly originY: number;
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

interface SelectGesture {
  readonly pointerId: number;
  readonly originX: number;
  readonly originY: number;
  readonly hitId: string | null;
  readonly canMove: boolean;
  lastX: number;
  lastY: number;
  moved: boolean;
  mode: 'pending' | 'move' | 'marquee';
  moveSent: boolean;
}

const GESTURE_THRESHOLD_PX = 4;

@Component({
  selector: 'app-viewport',
  host: {
    tabindex: '0',
    'data-viewport': '',
    'aria-label': 'Canvas',
    '[class.panning]': 'panning()',
    '[class.moving]': 'moving()',
    '[class.direct]': 'directCursor()',
    '[class.pen]': 'penTool()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(keydown)': 'onKeyDown($event)',
    '(keyup)': 'onKeyUp($event)',
    '(blur)': 'onBlur()',
    '(pointerleave)': 'onPointerLeave()',
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
  private select: SelectGesture | null = null;
  private direct: DirectDrag | null = null;
  private pen: PenDrag | null = null;
  private spaceHeld = false;

  protected readonly panning = signal(false);
  protected readonly moving = signal(false);
  protected readonly marquee = signal<DocumentRect | null>(null);
  protected readonly editing = computed(() => this.session.mode() === 'edit');
  protected readonly directCursor = computed(
    () => this.editing() && this.session.tool() === 'direct-select',
  );
  protected readonly penTool = computed(() => this.session.tool() === 'pen');
  private readonly penHover = signal<Vec2 | null>(null);
  private readonly penDragging = signal(false);
  protected readonly activeId = this.session.activeObjectId;

  protected readonly scene = computed(() => {
    const document = this.session.document();
    return document ? sceneFromDocument(document, this.session.clipperHold()) : null;
  });

  protected readonly selectedIds = computed(() => new Set(this.session.selectedObjectIds()));

  protected readonly anchorOverlay = computed(() => {
    if (this.session.mode() !== 'edit') {
      return null;
    }
    const document = this.session.document();
    const activeId = this.session.activeObjectId();
    const object = document?.objects.find((item) => item.id === activeId);
    if (!object) {
      return null;
    }
    const selected = new Set(this.session.selectedAnchorIds());
    const zoom = this.session.viewport().zoom || 1;
    const anchors: OverlayAnchor[] = [];
    const handles: OverlayHandle[] = [];
    for (const subpath of object.source.subpaths) {
      for (const anchor of subpath.anchors) {
        anchors.push({
          id: anchor.id,
          x: anchor.position.x,
          y: anchor.position.y,
          selected: selected.has(anchor.id),
        });
        if (anchor.handleIn) {
          handles.push(handleMark(anchor.id, 'in', anchor.position, anchor.handleIn));
        }
        if (anchor.handleOut) {
          handles.push(handleMark(anchor.id, 'out', anchor.position, anchor.handleOut));
        }
      }
    }
    return {
      transform: formatObjectTransform(object.transform),
      anchorSize: 8 / zoom,
      handleRadius: 3.5 / zoom,
      anchors,
      handles,
    };
  });

  protected readonly penPreview = computed(() => {
    if (this.penDragging()) {
      return null;
    }
    const hover = this.penHover();
    const objectId = this.session.penObjectId();
    const document = this.session.document();
    if (!hover || !objectId || !document) {
      return null;
    }
    const object = document.objects.find((item) => item.id === objectId);
    const subpath = object?.source.subpaths.at(-1);
    const anchor = subpath?.anchors.at(-1);
    if (!object || !subpath || subpath.closed || !anchor) {
      return null;
    }
    return {
      transform: formatObjectTransform(object.transform),
      d: penPreviewData(anchor, hover),
    };
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
    if (fromSpace || fromMiddle) {
      this.beginPan(event, fromSpace);
      return;
    }
    if (event.button !== 0) {
      return;
    }
    if (this.session.tool() === 'pen') {
      this.beginPen(event);
      return;
    }
    if (this.session.tool() === 'direct-select') {
      this.beginDirect(event);
      return;
    }
    this.beginSelect(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.pan && event.pointerId === this.pan.pointerId) {
      this.movePan(event);
      return;
    }
    if (this.pen && event.pointerId === this.pen.pointerId) {
      this.movePen(event);
      return;
    }
    if (this.direct && event.pointerId === this.direct.pointerId) {
      this.moveDirect(event);
      return;
    }
    if (this.select && event.pointerId === this.select.pointerId) {
      this.moveSelect(event);
      return;
    }
    this.trackPenPreview(event);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.pan && event.pointerId === this.pan.pointerId) {
      this.stopPan();
      return;
    }
    if (this.pen && event.pointerId === this.pen.pointerId) {
      this.finishPen(event);
      return;
    }
    if (this.direct && event.pointerId === this.direct.pointerId) {
      this.finishDirect(event);
      return;
    }
    if (this.select && event.pointerId === this.select.pointerId) {
      this.finishSelect(event);
    }
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

  protected onPointerLeave(): void {
    if (!this.pen) {
      this.penHover.set(null);
    }
  }

  protected onAuxClick(event: MouseEvent): void {
    if (event.button === 1) {
      event.preventDefault();
    }
  }

  private beginPan(event: PointerEvent, fromSpace: boolean): void {
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

  private movePan(event: PointerEvent): void {
    const pan = this.pan;
    if (!pan) {
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

  private beginSelect(event: PointerEvent): void {
    const document = this.session.document();
    if (!document || this.session.tool() !== 'select' || this.session.mode() !== 'object') {
      return;
    }
    const point = this.pointerToDocument(event);
    const hitId = hitTestObject(
      document,
      point,
      this.session.viewport().zoom,
      this.session.clipperHold(),
    );
    const hit = hitId ? (document.objects.find((object) => object.id === hitId) ?? null) : null;
    if (hit && !this.session.selectedObjectIds().includes(hit.id)) {
      this.bus.dispatch({
        type: 'session.select',
        target: 'object',
        ids: [hit.id],
        op: event.shiftKey ? 'add' : 'replace',
      });
    }
    this.select = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      hitId: hit?.id ?? null,
      canMove: !!hit && !isInteractionLocked(document, hit),
      moved: false,
      mode: 'pending',
      moveSent: false,
    };
    this.host.nativeElement.focus();
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
  }

  private moveSelect(event: PointerEvent): void {
    const gesture = this.select;
    if (!gesture) {
      return;
    }
    const distance = Math.hypot(event.clientX - gesture.originX, event.clientY - gesture.originY);
    if (!gesture.moved) {
      if (distance < GESTURE_THRESHOLD_PX) {
        return;
      }
      gesture.moved = true;
      if (gesture.hitId && gesture.canMove) {
        gesture.mode = 'move';
      } else if (!gesture.hitId) {
        gesture.mode = 'marquee';
      }
    }
    if (gesture.mode === 'move') {
      this.translateSelection(event, gesture);
      return;
    }
    if (gesture.mode === 'marquee') {
      this.marquee.set(this.marqueeRect(gesture.originX, gesture.originY, event));
    }
  }

  private translateSelection(event: PointerEvent, gesture: SelectGesture): void {
    const zoom = this.session.viewport().zoom || 1;
    const dx = (event.clientX - gesture.lastX) / zoom;
    const dy = (event.clientY - gesture.lastY) / zoom;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    if (dx === 0 && dy === 0) {
      return;
    }
    const gestureKind: TranslateGesture = gesture.moveSent ? 'continue' : 'begin';
    gesture.moveSent = true;
    this.moving.set(true);
    this.session.beginClipperHold();
    this.bus.dispatch({
      type: 'object.translate',
      ids: this.session.selectedObjectIds(),
      dx,
      dy,
      gesture: gestureKind,
    });
  }

  private finishSelect(event: PointerEvent): void {
    const gesture = this.select;
    this.select = null;
    this.moving.set(false);
    this.marquee.set(null);
    this.release(gesture?.pointerId);
    this.session.endClipperHold();
    if (!gesture) {
      return;
    }
    const document = this.session.document();
    if (gesture.mode === 'marquee' && document) {
      this.bus.dispatch({
        type: 'session.select',
        target: 'object',
        ids: objectsInRect(
          document,
          this.marqueeRect(gesture.originX, gesture.originY, event),
          this.session.clipperHold(),
        ),
        op: event.shiftKey ? 'add' : 'replace',
      });
      return;
    }
    if (!gesture.moved && !gesture.hitId && !event.shiftKey) {
      this.bus.dispatch({
        type: 'session.select',
        target: 'object',
        ids: [],
        op: 'clear',
      });
    }
  }

  private beginDirect(event: PointerEvent): void {
    if (this.session.mode() !== 'edit') {
      return;
    }
    const object = this.activeObject();
    const document = this.session.document();
    if (!object || !document) {
      return;
    }
    const localPoint = documentToLocal(object.transform, this.pointerToDocument(event));
    if (!localPoint) {
      return;
    }
    const started = beginDirectDrag({
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      shiftKey: event.shiftKey,
      object,
      blocked: isInteractionLocked(document, object),
      localPoint,
      zoom: this.session.viewport().zoom,
      selectedAnchorIds: this.session.selectedAnchorIds(),
    });
    this.direct = started.drag;
    for (const command of started.commands) {
      this.bus.dispatch(command);
    }
    this.host.nativeElement.focus();
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
  }

  private moveDirect(event: PointerEvent): void {
    const drag = this.direct;
    const object = this.activeObject();
    if (!drag || !object) {
      return;
    }
    const localPoint = documentToLocal(object.transform, this.pointerToDocument(event));
    if (!localPoint) {
      return;
    }
    const commands = updateDirectDrag(drag, {
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey,
      localPoint,
      zoom: this.session.viewport().zoom,
      transform: object.transform,
      selectedAnchorIds: this.session.selectedAnchorIds(),
    });
    if (commands.length > 0) {
      this.session.beginClipperHold();
    }
    for (const command of commands) {
      this.bus.dispatch(command);
    }
    if (drag.mode === 'anchors' && drag.moveSent) {
      this.moving.set(true);
    }
    if (drag.mode === 'marquee') {
      this.marquee.set(this.marqueeRect(drag.originX, drag.originY, event));
    }
  }

  private finishDirect(event: PointerEvent): void {
    const drag = this.direct;
    this.direct = null;
    this.moving.set(false);
    const rect =
      drag?.mode === 'marquee' ? this.marqueeRect(drag.originX, drag.originY, event) : null;
    this.marquee.set(null);
    this.release(drag?.pointerId);
    this.session.endClipperHold();
    if (!drag) {
      return;
    }
    const object = this.activeObject();
    const anchorIds = rect && object ? anchorsInRect(object, rect) : [];
    for (const command of finishDirectDrag(drag, { shiftKey: event.shiftKey, anchorIds })) {
      this.bus.dispatch(command);
    }
  }

  private beginPen(event: PointerEvent): void {
    const document = this.session.document();
    if (!document) {
      return;
    }
    const documentPoint = this.pointerToDocument(event);
    const penObject = this.penObject();
    const activeObject = this.activeObject();
    const localTarget = penObject ?? (this.session.mode() === 'edit' ? activeObject : null);
    const localPoint = localTarget ? documentToLocal(localTarget.transform, documentPoint) : null;
    const started = startPen({
      mode: this.session.mode(),
      documentPoint,
      zoom: this.session.viewport().zoom,
      penObject,
      activeObject,
      localPoint,
      isBlocked: (object) => isInteractionLocked(document, object),
    });
    for (const command of started.commands) {
      this.bus.dispatch(command);
    }
    if (started.place) {
      const placed = this.penObject();
      const anchor = placed?.source.subpaths.at(-1)?.anchors.at(-1);
      if (placed && anchor) {
        this.pen = {
          pointerId: event.pointerId,
          originX: event.clientX,
          originY: event.clientY,
          objectId: placed.id,
          anchorId: anchor.id,
          moved: false,
        };
        this.penDragging.set(true);
        this.penHover.set(null);
      }
    }
    this.host.nativeElement.focus();
    if (this.pen) {
      this.host.nativeElement.setPointerCapture?.(event.pointerId);
    }
  }

  private movePen(event: PointerEvent): void {
    const drag = this.pen;
    if (!drag) {
      return;
    }
    const object = this.session.document()?.objects.find((item) => item.id === drag.objectId);
    if (!object) {
      return;
    }
    const localPoint = documentToLocal(object.transform, this.pointerToDocument(event));
    const commands = updatePenDrag(drag, {
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey,
      localPoint,
    });
    if (commands.length > 0) {
      this.session.beginClipperHold();
    }
    for (const command of commands) {
      this.bus.dispatch(command);
    }
  }

  private finishPen(event: PointerEvent): void {
    this.pen = null;
    this.penDragging.set(false);
    this.release(event.pointerId);
    this.session.endClipperHold();
    if (this.session.penObjectId()) {
      this.trackPenPreview(event);
    } else {
      this.penHover.set(null);
    }
  }

  private trackPenPreview(event: PointerEvent): void {
    if (this.pen || this.session.tool() !== 'pen') {
      return;
    }
    const object = this.penObject();
    if (!object) {
      this.penHover.set(null);
      return;
    }
    this.penHover.set(documentToLocal(object.transform, this.pointerToDocument(event)));
  }

  private penObject(): VectorObject | null {
    const id = this.session.penObjectId();
    const document = this.session.document();
    if (!id || !document) {
      return null;
    }
    return document.objects.find((object) => object.id === id) ?? null;
  }

  private activeObject(): VectorObject | null {
    const document = this.session.document();
    const id = this.session.activeObjectId();
    if (!document || !id) {
      return null;
    }
    return document.objects.find((object) => object.id === id) ?? null;
  }

  private marqueeRect(originX: number, originY: number, event: PointerEvent): DocumentRect {
    const camera = this.session.viewport();
    const bounds = this.host.nativeElement.getBoundingClientRect();
    const origin = screenToDocument(camera, {
      x: originX - bounds.left,
      y: originY - bounds.top,
    });
    const current = screenToDocument(camera, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    return {
      x: origin.x,
      y: origin.y,
      width: current.x - origin.x,
      height: current.y - origin.y,
    };
  }

  private pointerToDocument(event: PointerEvent): Vec2 {
    const bounds = this.host.nativeElement.getBoundingClientRect();
    return screenToDocument(this.session.viewport(), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
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
    this.release(pan?.pointerId);
  }

  private release(pointerId: number | undefined): void {
    if (pointerId === undefined) {
      return;
    }
    const element = this.host.nativeElement;
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  }
}

function isSpace(event: KeyboardEvent): boolean {
  return event.key === ' ' || event.code === 'Space';
}

interface OverlayAnchor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly selected: boolean;
}

interface OverlayHandle {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

function handleMark(
  anchorId: string,
  slot: 'in' | 'out',
  position: Vec2,
  handle: Vec2,
): OverlayHandle {
  return {
    id: `${anchorId}-${slot}`,
    x1: position.x,
    y1: position.y,
    x2: handle.x,
    y2: handle.y,
  };
}
