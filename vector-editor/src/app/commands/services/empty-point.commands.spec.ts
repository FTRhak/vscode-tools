import { TestBed } from '@angular/core/testing';
import { isEmptyPoint, SessionService } from '@vector-editor/core';
import { CommandBus } from './command-bus.service';

describe('empty point commands', () => {
  let bus: CommandBus;
  let session: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(CommandBus);
    session = TestBed.inject(SessionService);
    bus.dispatch({ type: 'document.new' });
  });

  it('adds a selected point and keeps object mode', () => {
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'point.add', position: { x: 80, y: 90 } });

    const point = session.document()?.objects.find((object) => isEmptyPoint(object));
    expect(point?.transform).toMatchObject({ x: 80, y: 90 });
    expect(session.mode()).toBe('object');
    expect(session.selectedObjectIds()).toEqual([point?.id]);
    expect(session.activeObjectId()).toBe(point?.id);
    expect(session.history().entries.at(-1)?.label).toBe('Add empty point');
  });

  it('drops the point from edit-mode selection and ignores selecting it there', () => {
    bus.dispatch({ type: 'point.add', position: { x: 10, y: 20 } });
    const pointId = session.activeObjectId();
    const pathId = session.document()?.objects.find((object) => !isEmptyPoint(object))?.id;

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    expect(session.selectedObjectIds()).toEqual([]);
    expect(session.activeObjectId()).toBeNull();

    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [pointId ?? ''],
      op: 'replace',
    });
    expect(session.selectedObjectIds()).toEqual([]);

    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [pathId ?? '', pointId ?? ''],
      op: 'replace',
    });
    expect(session.selectedObjectIds()).toEqual([pathId]);
  });

  it('does not add a modifier to an empty point', () => {
    bus.dispatch({ type: 'point.add', position: { x: 1, y: 2 } });
    const pointId = session.activeObjectId() ?? '';
    bus.dispatch({ type: 'modifier.add', objectId: pointId, kind: 'array' });
    bus.dispatch({ type: 'modifier.applyAll', objectId: pointId });

    const point = session.document()?.objects.find((object) => object.id === pointId);
    expect(point?.modifiers).toEqual([]);
    expect(point?.kind).toBe('empty');
  });
});
