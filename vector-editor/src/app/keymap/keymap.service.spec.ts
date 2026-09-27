import { TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../commands/command-bus.service';
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
