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
});
