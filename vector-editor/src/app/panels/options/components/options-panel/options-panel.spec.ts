import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { OptionsPanel } from './options-panel';

describe('OptionsPanel', () => {
  let fixture: ComponentFixture<OptionsPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionsPanel],
    }).compileComponents();
    fixture = TestBed.createComponent(OptionsPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
  });

  it('shows nothing until an object is selected in object mode', async () => {
    expect(text()).toContain('Nothing selected');

    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
    expect(text()).toContain('Nothing selected');

    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    expect(field('Name').value).toBe('Path');
    expect(field('X').value).toBe('0');
    expect(text()).toContain('Layer Layer');
    expect(text()).toContain('Subpaths 1');
    expect(text()).toContain('Anchors 4');

    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    await fixture.whenStable();
    expect(text()).toContain('Nothing selected');
  });

  it('writes X on Enter and leaves the other transform fields alone', async () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    const input = field('X');
    input.value = '12';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform).toEqual({
      x: 12,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('does not record a second history step when the same value blurs again', async () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    const input = field('X');
    input.value = '12';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    const recorded = session.history().entries.length;
    input.dispatchEvent(new FocusEvent('blur'));

    expect(session.history().entries).toHaveLength(recorded);
    expect(session.document()!.objects[0].transform.x).toBe(12);
  });

  it('writes an anchor coordinate and moves its handles with it', async () => {
    bus.dispatch({ type: 'document.new' });
    const object = session.document()!.objects[0];
    const anchor = object.source.subpaths[0].anchors[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    bus.dispatch({ type: 'session.setMode', mode: 'edit' });
    bus.dispatch({ type: 'session.select', target: 'anchor', ids: [anchor.id], op: 'replace' });
    await fixture.whenStable();

    const input = field('X');
    input.value = '460';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    const moved = session.document()!.objects[0].source.subpaths[0].anchors[0];
    expect(moved.position.x).toBe(460);
    expect(moved.handleIn?.x).toBe(anchor.handleIn!.x + 10);
    expect(moved.handleOut?.x).toBe(anchor.handleOut!.x + 10);
  });

  function text(): string {
    return fixture.nativeElement.textContent ?? '';
  }

  function field(label: string): HTMLInputElement {
    const row = [...fixture.nativeElement.querySelectorAll('label')].find((item) =>
      item.textContent?.includes(label),
    );
    const input = row?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`${label} field is missing`);
    }
    return input;
  }
});
