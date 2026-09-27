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
  });
});
