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
});
