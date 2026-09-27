import { TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../../commands/command-bus.service';
import { FileActions } from '../../shell/services/file-actions.service';
import { KeymapService } from './keymap.service';

describe('KeymapService', () => {
  let bus: CommandBus;
  let session: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(CommandBus);
    session = TestBed.inject(SessionService);
    TestBed.inject(KeymapService);
  });

  it('undoes with Ctrl+Z and duplicates with Shift+D', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    bus.dispatch({ type: 'object.setFlags', ids: [id], name: 'Renamed' });

    document.dispatchEvent(key('z', { ctrlKey: true }));

    expect(session.document()!.objects[0].name).toBe('Path');

    document.dispatchEvent(key('d', { shiftKey: true }));

    expect(session.document()!.objects).toHaveLength(2);
    expect(session.selectedObjectIds()).toHaveLength(1);
    expect(session.selectedObjectIds()[0]).not.toBe(id);
  });

  it('redoes with Ctrl+Shift+Z', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.setFlags', ids: [id], name: 'Renamed' });
    document.dispatchEvent(key('z', { ctrlKey: true }));
    document.dispatchEvent(key('Z', { ctrlKey: true, shiftKey: true }));

    expect(session.document()!.objects[0].name).toBe('Renamed');
  });

  it('leaves Ctrl+Z alone while typing in a field', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.setFlags', ids: [id], name: 'Renamed' });
    const input = document.createElement('input');
    document.body.append(input);

    const event = key('z', { ctrlKey: true });
    input.dispatchEvent(event);
    input.remove();

    expect(event.defaultPrevented).toBe(false);
    expect(session.document()!.objects[0].name).toBe('Renamed');
  });

  it('switches the edit filter and deletes anchors only in edit mode', () => {
    bus.dispatch({ type: 'document.new' });
    const object = session.document()!.objects[0];
    const anchorId = object.source.subpaths[0].anchors[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });

    document.dispatchEvent(key('Delete'));
    document.dispatchEvent(key('2'));
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);
    expect(session.editSelectionKind()).toBe('anchor');

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    document.dispatchEvent(key('2'));
    expect(session.editSelectionKind()).toBe('segment');
    document.dispatchEvent(key('1'));
    expect(session.editSelectionKind()).toBe('anchor');

    bus.dispatch({ type: 'session.select', target: 'anchor', ids: [anchorId], op: 'replace' });
    const input = document.createElement('input');
    document.body.append(input);
    const typed = key('x');
    input.dispatchEvent(typed);
    input.remove();
    expect(typed.defaultPrevented).toBe(false);
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(4);

    document.dispatchEvent(key('x'));
    expect(session.document()!.objects[0].source.subpaths[0].anchors).toHaveLength(3);
    expect(session.selectedAnchorIds()).toEqual([]);
  });

  it('finishes an open pen stroke from the canvas and undoes the last point with Escape', () => {
    bus.dispatch({ type: 'document.new' });
    bus.dispatch({ type: 'session.setTool', tool: 'pen' });
    bus.dispatch({ type: 'pen.begin', position: { x: 4, y: 6 } });
    const objectId = session.penObjectId()!;
    bus.dispatch({ type: 'pen.addPoint', objectId, position: { x: 20, y: 6 } });

    const away = key('Enter');
    document.body.dispatchEvent(away);
    expect(away.defaultPrevented).toBe(false);
    expect(session.penObjectId()).toBe(objectId);

    const input = document.createElement('input');
    document.body.append(input);
    const typed = key('Enter');
    input.dispatchEvent(typed);
    input.remove();
    expect(typed.defaultPrevented).toBe(false);
    expect(session.penObjectId()).toBe(objectId);

    const viewport = document.createElement('div');
    viewport.setAttribute('data-viewport', '');
    document.body.append(viewport);
    const finished = key('Enter');
    viewport.dispatchEvent(finished);
    viewport.remove();

    expect(finished.defaultPrevented).toBe(true);
    expect(session.penObjectId()).toBeNull();
    expect(session.document()!.objects.at(-1)!.source.subpaths[0].closed).toBe(false);

    bus.dispatch({ type: 'pen.addPoint', objectId, position: { x: 30, y: 6 } });
    document.dispatchEvent(key('Escape'));
    expect(session.document()!.objects.at(-1)!.source.subpaths[0].anchors).toHaveLength(2);
    expect(session.penObjectId()).toBe(objectId);

    document.dispatchEvent(key('Escape'));
    document.dispatchEvent(key('Escape'));
    expect(session.document()!.objects).toHaveLength(1);
    expect(session.mode()).toBe('object');
    expect(session.penObjectId()).toBeNull();

    bus.dispatch({
      type: 'object.setFlags',
      ids: [session.document()!.objects[0].id],
      name: 'Kept',
    });
    document.dispatchEvent(key('Escape'));
    expect(session.document()!.objects[0].name).toBe('Kept');
  });

  it('hides selected objects with H and shows them again', () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });

    document.dispatchEvent(key('h'));
    expect(session.document()!.objects[0].visible).toBe(false);

    document.dispatchEvent(key('h'));
    expect(session.document()!.objects[0].visible).toBe(true);

    const input = document.createElement('input');
    document.body.append(input);
    const typed = key('h');
    input.dispatchEvent(typed);
    input.remove();

    expect(typed.defaultPrevented).toBe(false);
    expect(session.document()!.objects[0].visible).toBe(true);
  });

  it('opens and saves from the keyboard without handing the keys to the browser', () => {
    const files = TestBed.inject(FileActions);
    const saved = key('s', { ctrlKey: true });
    document.dispatchEvent(saved);

    expect(saved.defaultPrevented).toBe(true);
    expect(files.saveDialogOpen()).toBe(false);

    bus.dispatch({ type: 'document.new' });
    const withDocument = key('s', { ctrlKey: true });
    document.dispatchEvent(withDocument);

    expect(withDocument.defaultPrevented).toBe(true);
    expect(files.saveDialogOpen()).toBe(true);

    const opened = key('o', { ctrlKey: true });
    document.dispatchEvent(opened);
    expect(opened.defaultPrevented).toBe(true);

    const input = document.createElement('input');
    document.body.append(input);
    const typed = key('s', { ctrlKey: true });
    input.dispatchEvent(typed);
    input.remove();

    expect(typed.defaultPrevented).toBe(false);

    const radio = document.createElement('input');
    radio.type = 'radio';
    document.body.append(radio);
    const onRadio = key('s', { ctrlKey: true });
    radio.dispatchEvent(onRadio);
    radio.remove();

    expect(onRadio.defaultPrevented).toBe(true);
  });

  it('does not duplicate when nothing is selected', () => {
    bus.dispatch({ type: 'document.new' });

    document.dispatchEvent(key('d', { shiftKey: true }));

    expect(session.document()!.objects).toHaveLength(1);
  });
});

function key(keyName: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: keyName,
    bubbles: true,
    cancelable: true,
    ...init,
  });
}
