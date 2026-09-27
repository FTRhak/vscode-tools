import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../commands/command-bus.service';
import { Viewport } from './viewport';

describe('Viewport', () => {
  let fixture: ComponentFixture<Viewport>;
  let session: SessionService;
  let bus: CommandBus;
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(async () => {
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback(
          [
            {
              contentRect: new DOMRectReadOnly(0, 0, 1248, 848),
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      }
      unobserve(): void {}
      disconnect(): void {}
    };

    await TestBed.configureTestingModule({
      imports: [Viewport],
    }).compileComponents();
    fixture = TestBed.createComponent(Viewport);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  function canvas(): HTMLElement {
    return fixture.nativeElement;
  }

  it('fits the artboard into the canvas after New', () => {
    expect(session.viewport()).toEqual({ panX: 24, panY: 24, zoom: 1 });
    expect(canvas().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(canvas().querySelector('.artboard')).not.toBeNull();
  });

  it('zooms toward the cursor and cancels the wheel, including with Ctrl', () => {
    const cursor = { x: 100, y: 80 };
    const before = session.viewport();
    const documentX = (cursor.x - before.panX) / before.zoom;
    const documentY = (cursor.y - before.panY) / before.zoom;
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));

    const wheel = new WheelEvent('wheel', {
      deltaY: -120,
      clientX: cursor.x,
      clientY: cursor.y,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    canvas().dispatchEvent(wheel);

    const after = session.viewport();
    expect(wheel.defaultPrevented).toBe(true);
    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect((cursor.x - after.panX) / after.zoom).toBeCloseTo(documentX);
    expect((cursor.y - after.panY) / after.zoom).toBeCloseTo(documentY);
  });

  it('pans with the middle button and stops page autoscroll', async () => {
    const start = session.viewport();
    canvas().dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 1,
        pointerId: 1,
        clientX: 10,
        clientY: 20,
        bubbles: true,
        cancelable: true,
      }),
    );
    canvas().dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 40,
        clientY: 35,
        bubbles: true,
      }),
    );
    await fixture.whenStable();

    expect(canvas().classList.contains('panning')).toBe(true);
    expect(session.viewport()).toEqual({
      panX: start.panX + 30,
      panY: start.panY + 15,
      zoom: start.zoom,
    });

    const aux = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true });
    canvas().dispatchEvent(aux);
    expect(aux.defaultPrevented).toBe(true);

    canvas().dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    await fixture.whenStable();
    expect(canvas().classList.contains('panning')).toBe(false);
  });

  it('pans with space while the canvas is focused and ignores a plain left drag', async () => {
    const start = session.viewport();
    canvas().dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        pointerId: 2,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
    canvas().dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 2,
        clientX: 30,
        clientY: 30,
        bubbles: true,
      }),
    );
    expect(session.viewport()).toEqual(start);

    canvas().focus();
    const space = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    canvas().dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);

    canvas().dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        pointerId: 3,
        clientX: 5,
        clientY: 6,
        bubbles: true,
        cancelable: true,
      }),
    );
    canvas().dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 3,
        clientX: 15,
        clientY: 26,
        bubbles: true,
      }),
    );
    await fixture.whenStable();

    expect(session.viewport()).toEqual({
      panX: start.panX + 10,
      panY: start.panY + 20,
      zoom: start.zoom,
    });
    expect(canvas().classList.contains('panning')).toBe(true);
  });

  it('selects a clicked curve, drags it once, and restores it with one undo', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const id = session.document()!.objects[0].id;

    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointerup', 474, 424);
    await fixture.whenStable();

    expect(session.selectedObjectIds()).toEqual([id]);
    expect(canvas().querySelector('.selection')).not.toBeNull();

    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointermove', 504, 434);
    pointer(canvas(), 'pointermove', 514, 434);
    pointer(canvas(), 'pointerup', 514, 434);
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform).toMatchObject({ x: 40, y: 10 });
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].transform).toMatchObject({ x: 0, y: 0 });
    expect(session.selectedObjectIds()).toEqual([id]);
  });

  it('selects the curve with a marquee and clears it with an empty click', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const id = session.document()!.objects[0].id;

    pointer(canvas(), 'pointerdown', 24, 24);
    pointer(canvas(), 'pointermove', 924, 724);
    pointer(canvas(), 'pointerup', 924, 724);
    await fixture.whenStable();

    expect(session.selectedObjectIds()).toEqual([id]);

    pointer(canvas(), 'pointerdown', 24, 24);
    pointer(canvas(), 'pointerup', 24, 24);
    await fixture.whenStable();

    expect(session.selectedObjectIds()).toEqual([]);
  });

  it('ignores canvas clicks in edit mode and with the pen', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointerup', 474, 424);

    bus.dispatch({ type: 'session.setMode', mode: 'object' });
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointerup', 474, 424);
    await fixture.whenStable();

    expect(session.selectedObjectIds()).toEqual([]);
  });

  it('draws anchors in edit mode and moves one with direct select', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const object = session.document()!.objects[0];
    const anchor = object.source.subpaths[0].anchors[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    await fixture.whenStable();

    expect(canvas().querySelectorAll('.anchor')).toHaveLength(4);
    expect(canvas().classList.contains('direct')).toBe(false);

    bus.dispatch({ type: 'session.setTool', tool: 'direct-select' });
    await fixture.whenStable();
    expect(canvas().classList.contains('direct')).toBe(true);

    pointer(canvas(), 'pointerdown', 474, 274);
    pointer(canvas(), 'pointermove', 494, 274);
    pointer(canvas(), 'pointerup', 494, 274);
    await fixture.whenStable();

    const moved = session.document()!.objects[0].source.subpaths[0].anchors[0];
    expect(moved.id).toBe(anchor.id);
    expect(moved.position).toEqual({ x: anchor.position.x + 20, y: anchor.position.y });
    expect(moved.handleOut).toEqual({
      x: anchor.handleOut!.x + 20,
      y: anchor.handleOut!.y,
    });
    expect(
      session.history().entries.filter((entry) => entry.label === 'Move anchors'),
    ).toHaveLength(1);
  });

  it('bends a handle and keeps the opposite handle when Alt is held', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const object = session.document()!.objects[0];
    const anchor = object.source.subpaths[0].anchors[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'direct-select' });
    await fixture.whenStable();

    pointer(canvas(), 'pointerdown', 574, 204);
    canvas().dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        clientX: 594,
        clientY: 204,
        altKey: true,
      }),
    );
    pointer(canvas(), 'pointerup', 594, 204);
    await fixture.whenStable();

    const moved = session.document()!.objects[0].source.subpaths[0].anchors[0];
    expect(moved.handleOut).toEqual({ x: 570, y: 180 });
    expect(moved.handleIn).toEqual(anchor.handleIn);
  });

  it('does not enter edit mode when direct select is used in object mode', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const document = session.document();
    bus.dispatch({ type: 'session.setTool', tool: 'direct-select' });

    pointer(canvas(), 'pointerdown', 474, 274);
    pointer(canvas(), 'pointermove', 520, 274);
    pointer(canvas(), 'pointerup', 520, 274);
    await fixture.whenStable();

    expect(session.mode()).toBe('object');
    expect(session.document()).toBe(document);
    expect(session.selectedAnchorIds()).toEqual([]);
    expect(canvas().querySelector('.anchor')).toBeNull();
  });
});

function pointer(target: HTMLElement, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  );
}
