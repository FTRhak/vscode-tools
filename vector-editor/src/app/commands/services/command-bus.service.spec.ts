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

  it('creates a document with the requested view size', () => {
    bus.dispatch({ type: 'document.new', width: 640, height: 480 });

    expect(session.document()?.viewBox).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  it('replaces the document as one Open step and restores the previous session', () => {
    bus.dispatch({ type: 'document.new' });
    const original = session.document();
    const objectId = original?.objects[0]?.id;
    if (!original || !objectId) {
      throw new Error('Document is missing');
    }
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    bus.dispatch({ type: 'session.setViewport', panX: 10, panY: 4, zoom: 2 });
    bus.dispatch({ type: 'session.select', target: 'object', ids: [objectId], op: 'replace' });
    bus.dispatch({
      type: 'document.replace',
      document: { ...original, name: 'Imported', objects: [] },
    });

    expect(session.document()?.name).toBe('Imported');
    expect(session.document()?.objects).toEqual([]);
    expect(session.mode()).toBe('object');
    expect(session.tool()).toBe('pen');
    expect(session.viewport()).toEqual({ panX: 10, panY: 4, zoom: 2 });
    expect(session.selectedObjectIds()).toEqual([]);
    expect(session.penObjectId()).toBeNull();
    expect(session.history().entries.at(-1)?.label).toBe('Open');

    bus.dispatch({ type: 'history.undo' });

    expect(session.document()).toBe(original);
    expect(session.mode()).toBe('edit');
    expect(session.selectedObjectIds()).toEqual([objectId]);
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

  it('bakes the transform into path coordinates and resets it', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    const anchor = session.document()!.objects[0].source.subpaths[0].anchors[0];
    bus.dispatch({
      type: 'object.setTransform',
      ids: [id],
      transform: { x: 15, y: -3, rotation: 0, scaleX: 2, scaleY: 1 },
    });

    bus.dispatch({ type: 'object.applyTransform', id });

    const baked = session.document()!.objects[0];
    expect(baked.transform).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
    });
    expect(baked.source.subpaths[0].anchors[0].position).toEqual({
      x: anchor.position.x * 2 + 15,
      y: anchor.position.y - 3,
    });
    expect(baked.source.subpaths[0].anchors[0].handleOut).toEqual({
      x: anchor.handleOut!.x * 2 + 15,
      y: anchor.handleOut!.y - 3,
    });

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].transform).toMatchObject({ x: 15, y: -3, scaleX: 2 });
    expect(session.document()!.objects[0].source.subpaths[0].anchors[0].position).toEqual(
      anchor.position,
    );
  });

  it('does not bake an identity or locked transform', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    const recorded = session.history().entries.length;
    bus.dispatch({ type: 'object.applyTransform', id });
    expect(session.history().entries).toHaveLength(recorded);

    bus.dispatch({ type: 'object.setFlags', ids: [id], locked: true });
    bus.dispatch({ type: 'object.setTransform', ids: [id], transform: { x: 9 } });
    const afterLock = session.history().entries.length;
    bus.dispatch({ type: 'object.applyTransform', id });
    expect(session.document()!.objects[0].transform.x).toBe(9);
    expect(session.history().entries).toHaveLength(afterLock);
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
      originX: 0,
      originY: 0,
    });
  });

  it('places the rotation origin in document space and undoes a drag as one step', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({
      type: 'object.setRotationOrigin',
      ids: [id],
      x: 30,
      y: 10,
      gesture: 'begin',
    });
    bus.dispatch({
      type: 'object.setRotationOrigin',
      ids: [id],
      x: 30,
      y: 18,
      gesture: 'continue',
    });

    expect(session.document()!.objects[0].transform).toMatchObject({
      x: 0,
      y: 0,
      originX: 30,
      originY: 18,
    });
    expect(
      session.history().entries.filter((entry) => entry.label === 'Move rotation origin'),
    ).toHaveLength(1);
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].transform).toMatchObject({ originX: 0, originY: 0 });
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

  it('deletes the selected path and restores it with undo', () => {
    bus.dispatch({ type: 'document.new' });
    const original = session.document()!.objects[0];
    bus.dispatch({ type: 'object.duplicate', ids: [original.id] });
    const copyId = session.document()!.objects[1].id;
    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [original.id, copyId],
      op: 'replace',
    });
    bus.dispatch({ type: 'object.setFlags', ids: [original.id], locked: true });
    bus.dispatch({ type: 'object.delete', ids: [original.id, copyId] });

    expect(session.document()!.objects.map((object) => object.id)).toEqual([original.id]);
    expect(session.selectedObjectIds()).toEqual([original.id]);
    expect(session.activeObjectId()).toBe(original.id);
    expect(session.history().entries.at(-1)?.label).toBe('Delete');

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects.map((object) => object.id)).toEqual([original.id, copyId]);
    expect(session.selectedObjectIds()).toEqual([original.id, copyId]);
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
    expect(session.selectedLayerId()).toBe(front!.id);
    bus.dispatch({ type: 'layer.reorder', id: front!.id, index: 1 });
    expect(session.document()!.layers.find((layer) => layer.id === front!.id)?.order).toBe(0);
    expect(session.document()!.layers.find((layer) => layer.id === backId)?.order).toBe(1);
    expect(session.history().entries.at(-1)?.label).toBe('Reorder layer');
  });

  it('creates and assigns a gradient as one undoable command', () => {
    bus.dispatch({ type: 'document.new' });
    const objectId = session.document()!.objects[0].id;

    bus.dispatch({
      type: 'gradient.create',
      gradient: {
        name: 'Sunset',
        type: 'linear',
        angle: 135,
        proportions: 1.2,
        stops: [
          { id: 'stop-a', offset: 0, color: '#FF0000', opacity: 1 },
          { id: 'stop-b', offset: 0.5, color: '#00FF00', opacity: 0.5 },
          { id: 'stop-c', offset: 1, color: '#0000FF', opacity: 0.8 },
        ],
      },
      target: 'stroke',
      objectIds: [objectId],
    });

    const document = session.document()!;
    const gradient = document.gradients[0];
    expect(gradient).toMatchObject({
      name: 'Sunset',
      type: 'linear',
      angle: 135,
      proportions: 1.2,
      stops: [
        { color: '#ff0000', opacity: 1 },
        { color: '#00ff00', opacity: 0.5 },
        { color: '#0000ff', opacity: 0.8 },
      ],
    });
    expect(document.objects[0].style.stroke).toBe(`url(#${gradient.id})`);
    expect(session.history().entries.at(-1)?.label).toBe('Create gradient');

    bus.dispatch({ type: 'gradient.delete', id: gradient.id });
    expect(session.document()!.gradients).toEqual([]);
    expect(session.document()!.objects[0].style.stroke).toBeNull();
    expect(session.history().entries.at(-1)?.label).toBe('Delete gradient');

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.gradients).toEqual([gradient]);
    expect(session.document()!.objects[0].style.stroke).toBe(`url(#${gradient.id})`);

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.gradients).toEqual([]);
    expect(session.document()!.objects[0].style.stroke).not.toContain('url(#');
  });

  it('updates an existing gradient definition in place', () => {
    bus.dispatch({ type: 'document.new' });
    const objectId = session.document()!.objects[0].id;

    bus.dispatch({
      type: 'gradient.create',
      gradient: {
        name: 'Sunset',
        type: 'linear',
        angle: 0,
        proportions: 1,
        stops: [
          { id: 'stop-a', offset: 0, color: '#FF0000', opacity: 1 },
          { id: 'stop-b', offset: 1, color: '#0000FF', opacity: 1 },
        ],
      },
      target: 'fill',
      objectIds: [objectId],
    });

    const gradient = session.document()!.gradients[0];
    expect(session.document()!.objects[0].style.fill).toBe(`url(#${gradient.id})`);

    bus.dispatch({
      type: 'gradient.update',
      id: gradient.id,
      gradient: {
        name: 'Sunrise',
        type: 'radial',
        angle: 180,
        proportions: 1.8,
        stops: [
          { id: 'stop-a', offset: 0, color: '#00FF00', opacity: 0.2 },
          { id: 'stop-b', offset: 1, color: '#FFA500', opacity: 0.9 },
        ],
      },
    });

    expect(session.document()!.gradients[0]).toMatchObject({
      id: gradient.id,
      name: 'Sunrise',
      type: 'radial',
      angle: 180,
      proportions: 1.8,
      stops: [
        { color: '#00ff00', opacity: 0.2 },
        { color: '#ffa500', opacity: 0.9 },
      ],
    });
    expect(session.document()!.objects[0].style.fill).toBe(`url(#${gradient.id})`);
    expect(session.history().entries.at(-1)?.label).toBe('Update gradient');
  });

  it('deletes a layer with its objects and leaves a locked layer in place', () => {
    bus.dispatch({ type: 'document.new' });
    const backId = session.document()!.layers[0].id;
    const childId = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [childId], op: 'replace' });

    bus.dispatch({ type: 'layer.add' });
    const frontId = session.selectedLayerId()!;
    bus.dispatch({ type: 'path.add', layerId: frontId });
    const keptId = session.document()!.objects.at(-1)!.id;

    bus.dispatch({ type: 'layer.delete', id: backId });
    expect(session.document()!.layers.map((layer) => layer.id)).toEqual([frontId]);
    expect(session.document()!.objects.map((object) => object.id)).toEqual([keptId]);
    expect(session.selectedObjectIds()).toEqual([keptId]);
    expect(session.selectedLayerId()).toBe(frontId);
    expect(session.history().entries.at(-1)?.label).toBe('Delete layer');

    bus.dispatch({ type: 'layer.update', id: frontId, locked: true });
    const recorded = session.history().entries.length;
    bus.dispatch({ type: 'layer.delete', id: frontId });
    expect(session.document()!.layers).toHaveLength(1);
    expect(session.history().entries).toHaveLength(recorded);
  });

  it('adds a path on the selected layer and draws the pen there', () => {
    bus.dispatch({ type: 'document.new' });
    const backId = session.document()!.layers[0].id;
    expect(session.selectedLayerId()).toBe(backId);
    const recorded = session.history().entries.length;

    bus.dispatch({ type: 'session.selectLayer', id: 'missing' });
    expect(session.selectedLayerId()).toBe(backId);
    expect(session.history().entries).toHaveLength(recorded);

    bus.dispatch({ type: 'layer.add' });
    const frontId = session.selectedLayerId();
    expect(frontId).not.toBe(backId);
    bus.dispatch({ type: 'session.selectLayer', id: backId });
    expect(session.history().entries.at(-1)?.label).toBe('Add layer');

    bus.dispatch({ type: 'path.add', layerId: backId });
    const added = session.document()!.objects.at(-1);
    expect(added).toMatchObject({ name: 'Path 2', layerId: backId });
    expect(session.selectedObjectIds()).toEqual([added!.id]);
    expect(session.selectedLayerId()).toBe(backId);
    expect(session.history().entries.at(-1)?.label).toBe('Add path');

    bus.dispatch({ type: 'layer.update', id: backId, locked: true });
    const beforeLocked = session.history().entries.length;
    bus.dispatch({ type: 'path.add', layerId: backId });
    expect(session.document()!.objects).toHaveLength(2);
    expect(session.history().entries).toHaveLength(beforeLocked);

    bus.dispatch({ type: 'session.selectLayer', id: frontId! });
    bus.dispatch({ type: 'pen.begin', position: { x: 8, y: 9 } });
    expect(session.document()!.objects.at(-1)?.layerId).toBe(frontId);
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

  it('jumps to a snapshot without recording and drops the redo branch on the next command', () => {
    bus.dispatch({ type: 'session.setViewport', panX: 4, panY: 0, zoom: 1 });
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.setTool', tool: 'direct-select' });
    bus.dispatch({ type: 'object.setTransform', ids: [id], transform: { x: 12 } });

    const length = session.history().entries.length;
    expect(session.history().entries.map((entry) => entry.label)).toEqual([
      'New document',
      'Select',
      'Set transform',
    ]);

    bus.dispatch({ type: 'history.jump', index: 1 });
    expect(session.history().entries).toHaveLength(length);
    expect(session.history().index).toBe(1);
    expect(session.document()!.objects[0].transform.x).toBe(0);
    expect(session.mode()).toBe('object');
    expect(session.selectedObjectIds()).toEqual([id]);
    expect(session.tool()).toBe('direct-select');
    expect(session.viewport()).toEqual({ panX: 4, panY: 0, zoom: 1 });

    bus.dispatch({ type: 'history.jump', index: -1 });
    expect(session.document()).toBeNull();
    expect(session.history().index).toBe(-1);
    expect(session.history().entries).toHaveLength(length);
    expect(session.viewport()).toEqual({ panX: 4, panY: 0, zoom: 1 });

    bus.dispatch({ type: 'history.jump', index: 0 });
    bus.dispatch({ type: 'history.redo' });
    bus.dispatch({ type: 'history.redo' });
    const redone = {
      x: session.document()!.objects[0].transform.x,
      mode: session.mode(),
      selected: [...session.selectedObjectIds()],
      index: session.history().index,
    };
    bus.dispatch({ type: 'history.jump', index: 0 });
    bus.dispatch({ type: 'history.jump', index: 2 });
    expect({
      x: session.document()!.objects[0].transform.x,
      mode: session.mode(),
      selected: [...session.selectedObjectIds()],
      index: session.history().index,
    }).toEqual(redone);

    const atEnd = session.document();
    bus.dispatch({ type: 'history.jump', index: 2 });
    bus.dispatch({ type: 'history.jump', index: 9 });
    bus.dispatch({ type: 'history.jump', index: -2 });
    bus.dispatch({ type: 'history.jump', index: 1.5 });
    expect(session.document()).toBe(atEnd);
    expect(session.history().index).toBe(2);
    expect(session.history().entries).toHaveLength(length);

    bus.dispatch({ type: 'history.jump', index: 0 });
    expect(session.selectedObjectIds()).toEqual([]);
    expect(session.mode()).toBe('object');
    bus.dispatch({ type: 'object.setTransform', ids: [id], transform: { y: 3 } });
    expect(session.history().entries.map((entry) => entry.label)).toEqual([
      'New document',
      'Set transform',
    ]);
    expect(session.history().index).toBe(1);
    expect(session.document()!.objects[0].transform).toMatchObject({ x: 0, y: 3 });
  });

  it('bakes an array prefix, clears anchor selection, and undo restores the stack', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    const anchorId = session.document()!.objects[0].source.subpaths[0].anchors[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.select', target: 'anchor', ids: [anchorId], op: 'replace' });
    bus.dispatch({ type: 'modifier.add', objectId: id, kind: 'array' });
    bus.dispatch({ type: 'modifier.add', objectId: id, kind: 'mirror' });

    const added = session.document()!.objects[0].modifiers;
    expect(added.map((modifier) => modifier.type)).toEqual(['array', 'mirror']);
    expect(added[0]).toMatchObject({ count: 3, offsetX: 40, offsetY: 0, enabled: true });
    expect(added[1]).toMatchObject({ axis: 'x', enabled: true });

    bus.dispatch({ type: 'modifier.reorder', objectId: id, modifierId: added[1].id, index: 0 });
    expect(session.document()!.objects[0].modifiers.map((modifier) => modifier.type)).toEqual([
      'mirror',
      'array',
    ]);
    bus.dispatch({
      type: 'modifier.update',
      objectId: id,
      modifierId: added[0].id,
      patch: { count: 2.9, offsetX: 12 },
    });
    expect(session.document()!.objects[0].modifiers[1]).toMatchObject({ count: 2, offsetX: 12 });

    const arrayId = added[0].id;
    bus.dispatch({ type: 'modifier.reorder', objectId: id, modifierId: arrayId, index: 0 });
    bus.dispatch({ type: 'modifier.apply', objectId: id, modifierId: arrayId });

    const baked = session.document()!.objects[0];
    expect(baked.modifiers.map((modifier) => modifier.type)).toEqual(['mirror']);
    expect(baked.source.subpaths.length).toBeGreaterThan(1);
    expect(baked.source.subpaths[0]?.anchors[0]?.id).not.toBe(anchorId);
    expect(baked.transform).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
    });
    expect(session.selectedAnchorIds()).toEqual([]);
    expect(session.history().entries.at(-1)?.label).toBe('Apply modifier');

    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].modifiers.map((modifier) => modifier.id)).toEqual([
      arrayId,
      added[1].id,
    ]);
    expect(session.selectedAnchorIds()).toEqual([anchorId]);

    bus.dispatch({ type: 'modifier.applyAll', objectId: id });
    expect(session.document()!.objects[0].modifiers).toEqual([]);
    expect(session.history().entries.at(-1)?.label).toBe('Apply modifiers');
    bus.dispatch({ type: 'history.undo' });
    expect(session.document()!.objects[0].modifiers).toHaveLength(2);
  });
});
