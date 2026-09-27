import { TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from './command-bus.service';

describe('CommandBus', () => {
  let bus: CommandBus;
  let session: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(CommandBus);
    session = TestBed.inject(SessionService);
  });

  it('starts in object mode with the select tool and an empty canvas', () => {
    expect(session.mode()).toBe('object');
    expect(session.tool()).toBe('select');
    expect(session.penObjectId()).toBeNull();
    expect(session.document()).toBeNull();
    expect(session.viewport()).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  it('sets the mode', () => {
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });

    expect(session.mode()).toBe('edit');
    expect(session.tool()).toBe('select');
  });

  it('sets the tool', () => {
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });

    expect(session.tool()).toBe('pen');
    expect(session.mode()).toBe('object');
  });

  it('creates a document without resetting mode or tool', () => {
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    bus.dispatch({ type: 'document.new' });

    const document = session.document();
    expect(document?.viewBox).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
    expect(document?.objects).toHaveLength(1);
    expect(session.mode()).toBe('edit');
    expect(session.tool()).toBe('pen');
  });

  it('updates only the camera', () => {
    bus.dispatch({ type: 'document.new' });
    const document = session.document();
    bus.dispatch({ type: 'session.setViewport', panX: 12, panY: 24, zoom: 2 });

    expect(session.viewport()).toEqual({ panX: 12, panY: 24, zoom: 2 });
    expect(session.document()).toBe(document);
    expect(session.mode()).toBe('object');
    expect(session.tool()).toBe('select');
    expect(session.history().entries).toHaveLength(1);
  });

  it('selects, adds, and clears objects', () => {
    bus.dispatch({ type: 'document.new' });
    const first = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.duplicate', ids: [first] });
    const second = session.document()!.objects[1].id;

    bus.dispatch({ type: 'session.select', target: 'object', ids: [first], op: 'replace' });
    expect(session.selectedObjectIds()).toEqual([first]);
    expect(session.activeObjectId()).toBe(first);

    bus.dispatch({ type: 'session.select', target: 'object', ids: [second], op: 'add' });
    expect(session.selectedObjectIds()).toEqual([first, second]);
    expect(session.activeObjectId()).toBe(second);

    bus.dispatch({ type: 'session.select', target: 'object', ids: [second], op: 'toggle' });
    expect(session.selectedObjectIds()).toEqual([first]);
    expect(session.activeObjectId()).toBe(first);

    const recorded = session.history().entries.length;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [first], op: 'replace' });
    bus.dispatch({ type: 'session.select', target: 'object', ids: ['missing'], op: 'add' });
    expect(session.history().entries).toHaveLength(recorded);

    bus.dispatch({ type: 'session.select', target: 'object', ids: [], op: 'clear' });
    expect(session.selectedObjectIds()).toEqual([]);
    expect(session.activeObjectId()).toBeNull();
  });

  it('keeps object selection when the mode changes and does not record it', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    const recorded = session.history().entries.length;

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });

    expect(session.mode()).toBe('edit');
    expect(session.selectedObjectIds()).toEqual([id]);
    expect(session.history().entries).toHaveLength(recorded);
  });

  it('collapses a drag into one undo and drops the redo branch', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    bus.dispatch({ type: 'object.translate', ids: [id], dx: 10, dy: 0, gesture: 'begin' });
    bus.dispatch({ type: 'object.translate', ids: [id], dx: 5, dy: 3, gesture: 'continue' });

    expect(session.document()!.objects[0].transform).toMatchObject({ x: 15, y: 3 });
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].transform).toMatchObject({ x: 0, y: 0 });
    expect(session.selectedObjectIds()).toEqual([id]);

    bus.dispatch({ type: 'object.translate', ids: [id], dx: 2, dy: 0, gesture: 'begin' });
    bus.dispatch({ type: 'object.translate', ids: [id], dx: 2, dy: 0, gesture: 'begin' });
    expect(session.document()!.objects[0].transform.x).toBe(4);
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].transform.x).toBe(2);

    bus.dispatch({ type: 'history.undo' });
    bus.dispatch({ type: 'object.setTransform', ids: [id], transform: { rotation: 15 } });
    bus.dispatch({ type: 'history.redo' });
    expect(session.document()!.objects[0].transform).toMatchObject({ x: 0, y: 0, rotation: 15 });
  });

  it('patches only the transform fields that were sent', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.setTransform', ids: [id], transform: { x: 8 } });

    expect(session.document()!.objects[0].transform).toEqual({
      x: 8,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('does not move a locked object', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.setFlags', ids: [id], locked: true });
    bus.dispatch({ type: 'object.translate', ids: [id], dx: 5, dy: 4, gesture: 'begin' });

    expect(session.document()!.objects[0].transform).toMatchObject({ x: 0, y: 0 });
    expect(session.document()!.objects[0].locked).toBe(true);
  });

  it('duplicates the selection and undoes it in one step', () => {
    bus.dispatch({ type: 'document.new' });
    const original = session.document()!.objects[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [original.id], op: 'replace' });
    bus.dispatch({ type: 'object.duplicate', ids: [original.id] });

    const objects = session.document()!.objects;
    expect(objects).toHaveLength(2);
    const copy = objects[1];
    expect(copy.name).toBe('Path copy');
    expect(copy.transform).toMatchObject({ x: 24, y: 24 });
    expect(copy.id).not.toBe(original.id);
    const anchorIds = new Set(copy.source.subpaths[0].anchors.map((anchor) => anchor.id));
    expect(anchorIds.has(original.source.subpaths[0].anchors[0].id)).toBe(false);
    for (const segment of copy.source.subpaths[0].segments) {
      expect(anchorIds.has(segment.fromId)).toBe(true);
      expect(anchorIds.has(segment.toId)).toBe(true);
    }
    expect(session.selectedObjectIds()).toEqual([copy.id]);
    expect(session.activeObjectId()).toBe(copy.id);

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects).toHaveLength(1);
    expect(session.selectedObjectIds()).toEqual([original.id]);
  });

  it('clears anchors on a mode change without recording history', () => {
    bus.dispatch({ type: 'document.new' });
    const object = session.document()!.objects[0];
    const anchorId = object.source.subpaths[0].anchors[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.select', target: 'anchor', ids: [anchorId], op: 'replace' });
    const recorded = session.history().entries.length;

    bus.dispatch({ type: 'session.setMode', mode: 'object' });

    expect(session.mode()).toBe('object');
    expect(session.selectedObjectIds()).toEqual([object.id]);
    expect(session.selectedAnchorIds()).toEqual([]);
    expect(session.history().entries).toHaveLength(recorded);

    bus.dispatch({ type: 'session.select', target: 'anchor', ids: [anchorId], op: 'replace' });
    expect(session.selectedAnchorIds()).toEqual([]);
  });

  it('collapses an anchor drag into one undo and restores a deleted anchor', () => {
    bus.dispatch({ type: 'document.new' });
    const object = session.document()!.objects[0];
    const anchor = object.source.subpaths[0].anchors[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.select', target: 'anchor', ids: [anchor.id], op: 'replace' });
    bus.dispatch({
      type: 'path.translateAnchors',
      objectId: object.id,
      anchorIds: [anchor.id],
      dx: 4,
      dy: 1,
      gesture: 'begin',
    });
    bus.dispatch({
      type: 'path.translateAnchors',
      objectId: object.id,
      anchorIds: [anchor.id],
      dx: 2,
      dy: 0,
      gesture: 'continue',
    });

    const moved = session.document()!.objects[0].source.subpaths[0].anchors[0];
    expect(moved.position).toEqual({ x: anchor.position.x + 6, y: anchor.position.y + 1 });
    expect(moved.handleIn).toEqual({
      x: anchor.handleIn!.x + 6,
      y: anchor.handleIn!.y + 1,
    });
    expect(session.history().entries.at(-1)?.label).toBe('Move anchors');

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].source.subpaths[0].anchors[0].position).toEqual(
      anchor.position,
    );
    expect(
      session.history().entries.filter((entry) => entry.label === 'Move anchors'),
    ).toHaveLength(1);

    bus.dispatch({
      type: 'path.deleteAnchors',
      objectId: object.id,
      anchorIds: [anchor.id],
    });
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(3);
    expect(session.selectedAnchorIds()).toEqual([]);
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);
    expect(session.selectedAnchorIds()).toEqual([anchor.id]);
  });

  it('draws a pen path as one history step per click and drops the stroke outside edit', () => {
    bus.dispatch({ type: 'document.new' });
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    bus.dispatch({ type: 'pen.begin', position: { x: 10, y: 20 } });
    const objectId = session.penObjectId();
    const first = session.document()!.objects.at(-1)!;
    expect(session.mode()).toBe('edit');
    expect(session.tool()).toBe('pen');
    expect(first.source.subpaths[0].anchors).toHaveLength(1);
    expect(session.selectedAnchorIds()).toEqual([first.source.subpaths[0].anchors[0].id]);

    bus.dispatch({ type: 'pen.addPoint', objectId: objectId!, position: { x: 40, y: 20 } });
    const second = session.document()!.objects.at(-1)!.source.subpaths[0].anchors[1];
    bus.dispatch({
      type: 'pen.setHandles',
      objectId: objectId!,
      anchorId: second.id,
      handleOut: { x: 50, y: 30 },
      breakLink: false,
      gesture: 'continue',
    });
    bus.dispatch({
      type: 'pen.setHandles',
      objectId: objectId!,
      anchorId: second.id,
      handleOut: { x: 55, y: 28 },
      breakLink: false,
      gesture: 'continue',
    });

    const drawn = session.document()!.objects.at(-1)!.source.subpaths[0];
    expect(drawn.segments[0].kind).toBe('cubic');
    expect(drawn.anchors[1].handleIn).toEqual({ x: 25, y: 12 });
    expect(session.history().entries.filter((entry) => entry.label === 'Pen')).toHaveLength(2);

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects.at(-1)!.source.subpaths[0].anchors).toHaveLength(1);
    expect(session.penObjectId()).toBe(objectId);

    bus.dispatch({ type: 'pen.addPoint', objectId: objectId!, position: { x: 40, y: 20 } });
    bus.dispatch({ type: 'pen.finish', objectId: objectId!, closed: true });
    expect(session.document()!.objects.at(-1)!.source.subpaths[0].closed).toBe(true);
    expect(session.penObjectId()).toBeNull();
    expect(session.history().entries.at(-1)?.label).toBe('Close path');

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects.at(-1)!.source.subpaths[0].closed).toBe(false);
    expect(session.penObjectId()).toBeNull();

    bus.dispatch({ type: 'pen.addPoint', objectId: objectId!, position: { x: 70, y: 20 } });
    const recorded = session.history().entries.length;
    bus.dispatch({ type: 'pen.finish', objectId: objectId!, closed: false });
    expect(session.document()!.objects.at(-1)!.source.subpaths[0].closed).toBe(false);
    expect(session.penObjectId()).toBeNull();
    expect(session.history().entries).toHaveLength(recorded);

    bus.dispatch({ type: 'pen.addPoint', objectId: objectId!, position: { x: 90, y: 20 } });
    bus.dispatch({ type: 'session.setMode', mode: 'object' });
    expect(session.penObjectId()).toBeNull();
    expect(session.document()!.objects.at(-1)!.source.subpaths[0].anchors.length).toBeGreaterThan(
      1,
    );

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'pen.addPoint', objectId: objectId!, position: { x: 110, y: 20 } });
    bus.dispatch({ type: 'session.setTool', tool: 'select' });
    expect(session.penObjectId()).toBeNull();
    expect(session.mode()).toBe('edit');

    const sampleId = session.document()!.objects[0].id;
    bus.dispatch({ type: 'pen.addPoint', objectId: sampleId, position: { x: 1, y: 1 } });
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);
    expect(session.penObjectId()).toBeNull();

    bus.dispatch({ type: 'history.undo' });
    bus.dispatch({ type: 'history.undo' });
    bus.dispatch({ type: 'history.undo' });
    bus.dispatch({ type: 'history.undo' });
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects).toHaveLength(1);
    expect(session.mode()).toBe('object');
    expect(session.penObjectId()).toBeNull();
  });

  it('does not record a style, swatch, or layer edit that changes nothing', () => {
    bus.dispatch({ type: 'document.new' });
    const object = session.document()!.objects[0];
    const layerId = session.document()!.layers[0].id;
    const recorded = session.history().entries.length;

    bus.dispatch({ type: 'style.set', objectIds: [object.id], fill: object.style.fill });
    bus.dispatch({ type: 'style.set', objectIds: ['missing'], fill: '#ff0000' });
    bus.dispatch({ type: 'swatch.add', name: '  ', color: '#ff0000' });
    bus.dispatch({
      type: 'swatch.apply',
      swatchId: 'missing',
      target: 'fill',
      objectIds: [object.id],
    });
    bus.dispatch({ type: 'layer.update', id: layerId, name: '   ' });
    bus.dispatch({ type: 'layer.reorder', id: layerId, index: 0 });

    expect(session.history().entries).toHaveLength(recorded);
    expect(session.document()!.objects[0].style.fill).toBe(object.style.fill);
  });

  it('sets a fill, applies a swatch, and stacks a new layer in front', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    const backId = session.document()!.layers[0].id;

    bus.dispatch({ type: 'style.set', objectIds: [id], fill: '#FF0000' });
    expect(session.document()!.objects[0].style.fill).toBe('#ff0000');
    expect(session.history().entries.at(-1)?.label).toBe('Set fill');

    bus.dispatch({ type: 'swatch.add', name: 'Red', color: '#ff0000' });
    const swatchId = session.document()!.swatches[0].id;
    bus.dispatch({ type: 'swatch.apply', swatchId, target: 'stroke', objectIds: [id] });
    expect(session.document()!.objects[0].style.stroke).toBe('#ff0000');
    expect(session.history().entries.at(-1)?.label).toBe('Apply swatch');

    bus.dispatch({ type: 'layer.add' });
    const front = session.document()!.layers.find((layer) => layer.id !== backId);
    expect(front).toMatchObject({ name: 'Layer 2', order: 1 });
    bus.dispatch({ type: 'layer.reorder', id: front!.id, index: 1 });
    expect(session.document()!.layers.find((layer) => layer.id === front!.id)?.order).toBe(0);
    expect(session.document()!.layers.find((layer) => layer.id === backId)?.order).toBe(1);
    expect(session.history().entries.at(-1)?.label).toBe('Reorder layer');
  });

  it('does not move an object on a locked layer', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    const layerId = session.document()!.layers[0].id;
    bus.dispatch({ type: 'layer.update', id: layerId, locked: true });
    const recorded = session.history().entries.length;

    bus.dispatch({ type: 'object.translate', ids: [id], dx: 5, dy: 4, gesture: 'begin' });

    expect(session.document()!.objects[0].transform).toMatchObject({ x: 0, y: 0 });
    expect(session.history().entries).toHaveLength(recorded);
  });
});
