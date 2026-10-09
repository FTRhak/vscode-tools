import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { ImagePlace } from '../../services/image-place.service';
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

    pointer(canvas(), 'pointerdown', 140, 60);
    pointer(canvas(), 'pointerup', 140, 60);
    await fixture.whenStable();

    expect(session.selectedObjectIds()).toEqual([]);
  });

  it('ignores select clicks in edit mode', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointerup', 474, 424);
    await fixture.whenStable();

    expect(session.selectedObjectIds()).toEqual([]);
    expect(session.document()!.objects).toHaveLength(1);
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

  it('adds a point on the active path in edit mode', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const object = session.document()!.objects[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'add-point' });
    await fixture.whenStable();
    expect(canvas().classList.contains('add-point')).toBe(true);

    pointer(canvas(), 'pointerdown', 687.75, 266.5);
    pointer(canvas(), 'pointerup', 687.75, 266.5);
    await fixture.whenStable();

    const subpath = session.document()!.objects[0].source.subpaths[0];
    const added = subpath.anchors.find((anchor) => anchor.id === session.selectedAnchorIds()[0]);
    expect(subpath.anchors).toHaveLength(5);
    expect(subpath.segments).toHaveLength(5);
    expect(added?.position.x).toBeCloseTo(663.75, 0);
    expect(added?.position.y).toBeCloseTo(242.5, 0);
    expect(session.history().entries.at(-1)?.label).toBe('Add point');

    bus.dispatch({ type: 'history.undo' });
    await fixture.whenStable();
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);
  });

  it('does not add a point outside edit mode, on an anchor, off the path, or when locked', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const object = session.document()!.objects[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setTool', tool: 'add-point' });

    pointer(canvas(), 'pointerdown', 687.75, 266.5);
    pointer(canvas(), 'pointerup', 687.75, 266.5);
    await fixture.whenStable();
    expect(session.mode()).toBe('object');
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    pointer(canvas(), 'pointerdown', 474, 274);
    pointer(canvas(), 'pointerup', 474, 274);
    pointer(canvas(), 'pointerdown', 40, 40);
    pointer(canvas(), 'pointerup', 40, 40);
    await fixture.whenStable();
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);

    bus.dispatch({ type: 'object.setFlags', ids: [object.id], locked: true });
    pointer(canvas(), 'pointerdown', 687.75, 266.5);
    pointer(canvas(), 'pointerup', 687.75, 266.5);
    await fixture.whenStable();
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);
    expect(session.document()!.objects[0].locked).toBe(true);
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

  it('draws a cubic with the pen, closes it, and leaves a closed path alone', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    await fixture.whenStable();
    expect(canvas().classList.contains('pen')).toBe(true);

    pointer(canvas(), 'pointerdown', 124, 224);
    pointer(canvas(), 'pointerup', 124, 224);
    pointer(canvas(), 'pointermove', 180, 224);
    await fixture.whenStable();

    expect(session.mode()).toBe('edit');
    expect(session.document()!.objects).toHaveLength(2);
    expect(canvas().querySelectorAll('.anchor')).toHaveLength(1);
    expect(canvas().querySelector('.pen-preview')?.getAttribute('d')).toContain('L');

    pointer(canvas(), 'pointerdown', 224, 224);
    pointer(canvas(), 'pointermove', 224, 264);
    await fixture.whenStable();
    expect(canvas().querySelector('.pen-preview')).toBeNull();
    pointer(canvas(), 'pointerup', 224, 264);
    await fixture.whenStable();

    const drawn = session.document()!.objects[1].source.subpaths[0];
    expect(drawn.anchors[1].position).toEqual({ x: 200, y: 200 });
    expect(drawn.anchors[1].handleOut).toEqual({ x: 200, y: 240 });
    expect(drawn.anchors[1].handleIn).toEqual({ x: 200, y: 160 });
    expect(drawn.segments[0].kind).toBe('cubic');
    expect(session.history().entries.filter((entry) => entry.label === 'Pen')).toHaveLength(2);

    pointer(canvas(), 'pointerdown', 124, 224);
    pointer(canvas(), 'pointerup', 124, 224);
    await fixture.whenStable();

    const closed = session.document()!.objects[1].source.subpaths[0];
    expect(closed.closed).toBe(true);
    expect(closed.segments).toHaveLength(2);
    expect(session.penObjectId()).toBeNull();
    expect(canvas().querySelector('.pen-preview')).toBeNull();

    bus.dispatch({ type: 'history.undo' });
    await fixture.whenStable();
    expect(session.document()!.objects[1].source.subpaths[0].closed).toBe(false);

    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    const sample = session.document()!.objects[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [sample.id], op: 'replace' });
    pointer(canvas(), 'pointerdown', 300, 300);
    pointer(canvas(), 'pointerup', 300, 300);
    await fixture.whenStable();
    expect(session.document()!.objects).toHaveLength(2);
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);
    expect(session.document()!.objects[1].source.subpaths[0].anchors).toHaveLength(2);
  });

  it('keeps a corner when the pen click does not drag and breaks the handle with Alt', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });

    pointer(canvas(), 'pointerdown', 124, 224);
    pointer(canvas(), 'pointerup', 124, 224);
    pointer(canvas(), 'pointerdown', 224, 224);
    pointer(canvas(), 'pointerup', 224, 224);
    await fixture.whenStable();

    const corner = session.document()!.objects[1].source.subpaths[0];
    expect(corner.segments[0].kind).toBe('line');
    expect(corner.anchors[1].handleOut).toBeNull();

    pointer(canvas(), 'pointerdown', 324, 224);
    canvas().dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        clientX: 364,
        clientY: 224,
        altKey: true,
      }),
    );
    pointer(canvas(), 'pointerup', 364, 224);
    await fixture.whenStable();

    const alt = session.document()!.objects[1].source.subpaths[0];
    expect(alt.anchors[2].handleOut).toEqual({ x: 340, y: 200 });
    expect(alt.anchors[2].handleIn).toBeNull();
    expect(alt.segments[1].kind).toBe('line');
  });

  it('continues an open path in edit mode and then moves an anchor with direct select', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    pointer(canvas(), 'pointerdown', 124, 224);
    pointer(canvas(), 'pointerup', 124, 224);
    pointer(canvas(), 'pointerdown', 224, 224);
    pointer(canvas(), 'pointerup', 224, 224);
    bus.dispatch({ type: 'pen.finish', objectId: session.penObjectId()!, closed: false });
    await fixture.whenStable();

    expect(session.penObjectId()).toBeNull();
    expect(session.document()!.objects[1].source.subpaths[0].closed).toBe(false);

    pointer(canvas(), 'pointerdown', 324, 224);
    pointer(canvas(), 'pointerup', 324, 224);
    await fixture.whenStable();
    expect(session.document()!.objects[1].source.subpaths[0].anchors).toHaveLength(3);

    bus.dispatch({ type: 'session.setTool', tool: 'direct-select' });
    pointer(canvas(), 'pointerdown', 124, 224);
    pointer(canvas(), 'pointermove', 144, 224);
    pointer(canvas(), 'pointerup', 144, 224);
    await fixture.whenStable();

    expect(session.document()!.objects[1].source.subpaths[0].anchors[0].position).toEqual({
      x: 120,
      y: 200,
    });
  });

  it('shows the snap control at the top and toggles snapping from the magnet', async () => {
    const bar = canvas().querySelector('[data-snap-bar]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.getAttribute('aria-label')).toBe('Snapping');
    const magnet = canvas().querySelector('.snap-magnet') as HTMLButtonElement;
    expect(magnet.getAttribute('aria-pressed')).toBe('false');
    expect(magnet.getAttribute('data-snap-mode')).toBe('off');

    magnet.click();
    await fixture.whenStable();
    expect(magnet.getAttribute('data-snap-mode')).toBe('grid_100');
    expect(magnet.getAttribute('aria-pressed')).toBe('true');

    magnet.click();
    await fixture.whenStable();
    expect(magnet.getAttribute('data-snap-mode')).toBe('off');
  });

  it('snaps an object move onto whole numbers', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    await chooseSnap(fixture, 'grid_100');

    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointermove', 484.4, 424.6);
    pointer(canvas(), 'pointerup', 484.4, 424.6);
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform).toMatchObject({ x: 10, y: 1 });
  });

  it('snaps an anchor move onto the grid in edit mode', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const object = session.document()!.objects[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'direct-select' });
    await chooseSnap(fixture, 'grid_010');
    await fixture.whenStable();

    pointer(canvas(), 'pointerdown', 474, 274);
    pointer(canvas(), 'pointermove', 494.26, 274.44);
    pointer(canvas(), 'pointerup', 494.26, 274.44);
    await fixture.whenStable();

    expect(session.document()!.objects[0].source.subpaths[0].anchors[0].position).toEqual({
      x: 470.3,
      y: 250.4,
    });
  });

  it('snaps a moving object to another object on the same layer', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.duplicate', ids: [id] });
    await chooseSnap(fixture, 'object');
    await fixture.whenStable();

    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointermove', 454, 404);
    pointer(canvas(), 'pointerup', 454, 404);
    await fixture.whenStable();

    expect(session.document()!.objects[1].transform).toMatchObject({ x: 0, y: 0 });
  });

  it('snaps an edited anchor to another object on the same layer', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const original = session.document()!.objects[0];
    bus.dispatch({ type: 'object.duplicate', ids: [original.id] });
    bus.dispatch({ type: 'session.select', target: 'object', ids: [original.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'direct-select' });
    await chooseSnap(fixture, 'object');
    await fixture.whenStable();

    pointer(canvas(), 'pointerdown', 474, 274);
    pointer(canvas(), 'pointermove', 494, 294);
    pointer(canvas(), 'pointerup', 494, 294);
    await fixture.whenStable();

    expect(session.document()!.objects[0].source.subpaths[0].anchors[0].position).toEqual({
      x: 474,
      y: 274,
    });
  });

  it('snaps to objects on other layers only in layer mode', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.duplicate', ids: [id] });
    bus.dispatch({ type: 'layer.add' });
    const current = session.document()!;
    const copyId = current.objects[1].id;
    const otherLayerId = current.layers.at(-1)!.id;
    bus.dispatch({
      type: 'document.replace',
      document: {
        ...current,
        objects: current.objects.map((object) =>
          object.id === copyId ? { ...object, layerId: otherLayerId } : object,
        ),
      },
    });
    await chooseSnap(fixture, 'object');
    await fixture.whenStable();

    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointermove', 454, 404);
    pointer(canvas(), 'pointerup', 454, 404);
    await fixture.whenStable();
    expect(session.document()!.objects[1].transform).toMatchObject({ x: 4, y: 4 });

    bus.dispatch({ type: 'history.undo' });
    await chooseSnap(fixture, 'layer');
    pointer(canvas(), 'pointerdown', 474, 424);
    pointer(canvas(), 'pointermove', 454, 404);
    pointer(canvas(), 'pointerup', 454, 404);
    await fixture.whenStable();

    expect(session.document()!.objects[1].transform).toMatchObject({ x: 0, y: 0 });
  });

  it('draws the rotation origin and drags it without moving the object', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    const marker = canvas().querySelector('.rotation-origin circle');
    expect(marker?.getAttribute('cx')).toBe('0');
    expect(marker?.getAttribute('cy')).toBe('0');

    pointer(canvas(), 'pointerdown', 24, 24);
    pointer(canvas(), 'pointermove', 124, 74);
    pointer(canvas(), 'pointermove', 224, 74);
    pointer(canvas(), 'pointerup', 224, 74);
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform).toMatchObject({
      x: 0,
      y: 0,
      rotation: 0,
      originX: 200,
      originY: 50,
    });
    expect(canvas().querySelector('.rotation-origin circle')?.getAttribute('cx')).toBe('200');
    expect(session.history().entries.at(-1)?.label).toBe('Move rotation origin');

    bus.dispatch({ type: 'object.setTransform', ids: [id], transform: { rotation: 90 } });
    await fixture.whenStable();

    const transform = canvas()
      .querySelector('.selection')
      ?.parentElement?.getAttribute('transform');
    expect(transform).toContain('rotate(90 200 50)');
    expect(canvas().querySelector('.rotation-origin circle')?.getAttribute('cx')).toBe('200');
    expect(canvas().querySelector('.rotation-origin circle')?.getAttribute('cy')).toBe('50');

    bus.dispatch({ type: 'history.undo' });
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].transform).toMatchObject({
      rotation: 0,
      originX: 0,
      originY: 0,
    });
  });

  it('draws a rectangle path and creates one from the size dialog', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'rectangle' });
    pointer(canvas(), 'pointerdown', 124, 144);
    pointer(canvas(), 'pointermove', 224, 244);
    await fixture.whenStable();
    expect(canvas().querySelector('.shape-preview')).not.toBeNull();

    pointer(canvas(), 'pointerup', 224, 244);
    await fixture.whenStable();

    const rectangle = session.document()!.objects.find((object) => object.name === 'Rectangle');
    expect(rectangle?.kind).toBe('path');
    expect(rectangle?.source.subpaths[0]).toMatchObject({ closed: true });
    expect(rectangle?.source.subpaths[0]?.anchors).toHaveLength(4);
    expect(rectangle?.source.subpaths[0]?.anchors[0]?.position).toEqual({ x: 100, y: 120 });
    expect(rectangle?.source.subpaths[0]?.anchors[2]?.position).toEqual({ x: 200, y: 220 });
    expect(session.selectedObjectIds()).toEqual([rectangle?.id]);
    expect(session.tool()).toBe('rectangle');
    expect(session.mode()).toBe('object');
    expect(session.history().entries.at(-1)?.label).toBe('Add shape');
    expect(canvas().querySelector('.shape-preview')).toBeNull();

    const before = session.document()!.objects.length;
    pointer(canvas(), 'pointerdown', 300, 300);
    pointer(canvas(), 'pointerup', 301, 301);
    await fixture.whenStable();

    const dialog = canvas().querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Rectangle');
    const width = dialog?.querySelector('#shape-width');
    const height = dialog?.querySelector('#shape-height');
    if (!(width instanceof HTMLInputElement) || !(height instanceof HTMLInputElement)) {
      throw new Error('Size fields are missing');
    }
    width.value = '80';
    width.dispatchEvent(new Event('input', { bubbles: true }));
    height.value = '40';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    (dialog?.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.click();
    await fixture.whenStable();

    expect(canvas().querySelector('[role="dialog"]')).toBeNull();
    expect(session.document()!.objects).toHaveLength(before + 1);
    const sized = session.document()!.objects.at(-1);
    expect(sized?.name).toBe('Rectangle 2');
    expect(sized?.source.subpaths[0]?.anchors[0]?.position).toEqual({ x: 276, y: 276 });
    expect(sized?.source.subpaths[0]?.anchors[2]?.position).toEqual({ x: 356, y: 316 });
  });

  it('places an image at native size, from a drag, and with shift', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    const before = session.document()!.objects.length;
    bus.dispatch({ type: 'session.setTool', tool: 'image' });
    pointer(canvas(), 'pointerdown', 124, 144);
    pointer(canvas(), 'pointerup', 124, 144);
    await fixture.whenStable();
    expect(session.document()!.objects).toHaveLength(before);

    TestBed.inject(ImagePlace).arm({
      fileName: 'photo.png',
      name: 'Photo',
      mime: 'image/png',
      dataUrl: pixel,
      pixelWidth: 10,
      pixelHeight: 20,
    });
    pointer(canvas(), 'pointerdown', 124, 144);
    pointer(canvas(), 'pointerup', 126, 146);
    await fixture.whenStable();

    const clicked = session.document()!.objects.at(-1);
    expect(clicked?.kind).toBe('image');
    expect(clicked?.image).toMatchObject({
      width: 10,
      height: 20,
      preserveAspectRatio: 'xMidYMid meet',
    });
    expect(clicked?.transform).toMatchObject({ x: 100, y: 120 });
    expect(session.history().entries.at(-1)?.label).toBe('Add image');
    expect(canvas().querySelector('image')).not.toBeNull();

    pointer(canvas(), 'pointerdown', 224, 224);
    pointer(canvas(), 'pointermove', 324, 274);
    await fixture.whenStable();
    expect(canvas().querySelector('.image-preview')).not.toBeNull();
    pointer(canvas(), 'pointerup', 324, 274);
    await fixture.whenStable();
    expect(session.document()!.objects.at(-1)?.image).toMatchObject({
      width: 100,
      height: 50,
      preserveAspectRatio: 'none',
    });
    expect(session.document()!.objects.at(-1)?.transform).toMatchObject({ x: 200, y: 200 });

    pointer(canvas(), 'pointerdown', 400, 400, true);
    pointer(canvas(), 'pointermove', 500, 420, true);
    pointer(canvas(), 'pointerup', 500, 420, true);
    await fixture.whenStable();
    expect(session.document()!.objects.at(-1)?.image).toMatchObject({
      width: 100,
      height: 200,
      preserveAspectRatio: 'xMidYMid meet',
    });
    expect(canvas().querySelector('.image-preview')).toBeNull();
  });

  it('places an empty point, moves it, and hides it in edit mode', async () => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1248, 848));
    bus.dispatch({ type: 'session.setTool', tool: 'empty-point' });
    pointer(canvas(), 'pointerdown', 124, 144);
    await fixture.whenStable();

    const point = session.document()!.objects.find((object) => object.kind === 'empty');
    expect(point?.transform).toMatchObject({ x: 100, y: 120 });
    expect(canvas().querySelector('.empty-point.selected')).not.toBeNull();
    expect(canvas().querySelector('.rotation-origin')).toBeNull();

    bus.dispatch({ type: 'session.setTool', tool: 'select' });
    pointer(canvas(), 'pointerdown', 124, 144);
    pointer(canvas(), 'pointermove', 164, 164);
    pointer(canvas(), 'pointerup', 164, 164);
    await fixture.whenStable();

    const moved = session.document()!.objects.find((object) => object.id === point?.id);
    expect(moved?.transform).toMatchObject({ x: 140, y: 140 });

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    await fixture.whenStable();
    expect(canvas().querySelector('.empty-point')).toBeNull();
    expect(session.selectedObjectIds()).not.toContain(point?.id);
  });
});

async function chooseSnap(fixture: ComponentFixture<Viewport>, mode: string): Promise<void> {
  const host = fixture.nativeElement as HTMLElement;
  (host.querySelector('.snap-element') as HTMLButtonElement).click();
  await fixture.whenStable();
  const choice = host.querySelector(`[data-snap-choice="${mode}"]`) as HTMLButtonElement | null;
  if (!choice) {
    throw new Error(`Missing snap mode ${mode}`);
  }
  choice.click();
  await fixture.whenStable();
}

function pointer(target: HTMLElement, type: string, x: number, y: number, shiftKey = false): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      button: 0,
      clientX: x,
      clientY: y,
      shiftKey,
    }),
  );
}

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
