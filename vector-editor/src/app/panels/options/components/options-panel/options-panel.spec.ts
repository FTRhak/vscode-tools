import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { PanelOptionsModule } from '../../options.module';
import { OptionsPanel } from './options-panel';

describe('OptionsPanel', () => {
  let fixture: ComponentFixture<OptionsPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelOptionsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(OptionsPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.panel-accordion-header').click();
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
      originX: 0,
      originY: 0,
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

  it('sets the rotation pivot in document coordinates and keeps it fixed while rotating', async () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    const pivotX = field('Pivot X');
    pivotX.value = '40';
    pivotX.dispatchEvent(new Event('input', { bubbles: true }));
    pivotX.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform).toMatchObject({
      x: 0,
      y: 0,
      rotation: 0,
      originX: 40,
      originY: 0,
    });

    const rotation = field('Rotation');
    rotation.value = '90';
    rotation.dispatchEvent(new Event('input', { bubbles: true }));
    rotation.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform).toMatchObject({
      x: 0,
      y: 0,
      rotation: 90,
      originX: 40,
      originY: 0,
    });
    expect(field('Pivot X').value).toBe('40');
    expect(field('Pivot Y').value).toBe('0');
  });

  it('applies the transform into the path and clears the transform fields', async () => {
    bus.dispatch({ type: 'document.new' });
    const object = session.document()!.objects[0];
    const anchor = object.source.subpaths[0].anchors[0];
    bus.dispatch({ type: 'session.select', target: 'object', ids: [object.id], op: 'replace' });
    await fixture.whenStable();

    const apply = button('Apply');
    expect(apply.disabled).toBe(true);

    const input = field('X');
    input.value = '12';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(apply.disabled).toBe(false);
    apply.click();
    await fixture.whenStable();

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
    expect(baked.source.subpaths[0].anchors[0].position.x).toBe(anchor.position.x + 12);
    expect(field('X').value).toBe('0');
    expect(apply.disabled).toBe(true);
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

  function button(label: string): HTMLButtonElement {
    const match = [...fixture.nativeElement.querySelectorAll('button')].find((item) =>
      item.textContent?.includes(label),
    );
    if (!(match instanceof HTMLButtonElement)) {
      throw new Error(`${label} button is missing`);
    }
    return match;
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
