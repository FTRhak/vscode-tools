import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBus } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
import { StrokePanel } from './stroke-panel';

describe('StrokePanel', () => {
  let fixture: ComponentFixture<StrokePanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrokePanel],
    }).compileComponents();
    fixture = TestBed.createComponent(StrokePanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.panel-accordion-header').click();
    await fixture.whenStable();
  });

  it('shows an empty message until an object is selected', async () => {
    expect(fixture.nativeElement.textContent).toContain('No stroke yet.');

    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No stroke yet.');

    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('No stroke yet.');
    expect(input('Stroke width').value).toBe('4');
    expect(select('Line cap').value).toBe('butt');
    expect(select('Line join').value).toBe('miter');
    expect(input('Miter limit').value).toBe('4');
    expect(input('Opacity').value).toBe('1');
    expect(input('Opacity').min).toBe('0');
    expect(input('Opacity').max).toBe('1');
    expect(input('Dash array').value).toBe('');
    expect(input('Dash offset').value).toBe('0');
  });

  it('writes the shared width on Enter and on blur', async () => {
    const id = selectFirst();
    await fixture.whenStable();

    const entered = input('Stroke width');
    entered.value = '6';
    entered.dispatchEvent(new Event('input', { bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    entered.dispatchEvent(enter);
    await fixture.whenStable();

    expect(enter.defaultPrevented).toBe(true);
    expect(session.document()!.objects[0].style.strokeWidth).toBe(6);
    expect(session.history().entries.at(-1)?.label).toBe('Set stroke width');

    const blurred = input('Stroke width');
    blurred.value = '2.5';
    blurred.dispatchEvent(new Event('input', { bubbles: true }));
    blurred.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();

    expect(session.document()!.objects.find((object) => object.id === id)?.style.strokeWidth).toBe(
      2.5,
    );
  });

  it('skips a matching, negative, or empty width', async () => {
    selectFirst();
    await fixture.whenStable();

    commitValue('4');
    const recorded = session.history().entries.length;
    expect(session.document()!.objects[0].style.strokeWidth).toBe(4);

    commitValue('-1');
    commitValue('');
    await fixture.whenStable();

    expect(session.history().entries).toHaveLength(recorded);
    expect(session.document()!.objects[0].style.strokeWidth).toBe(4);
  });

  it('leaves the field empty when selected widths differ', async () => {
    const first = selectFirst();
    bus.dispatch({ type: 'object.duplicate', ids: [first] });
    const second = session.document()!.objects[1].id;
    bus.dispatch({ type: 'style.set', objectIds: [second], strokeWidth: 8 });
    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [first, second],
      op: 'replace',
    });
    await fixture.whenStable();

    expect(input('Stroke width').value).toBe('');
  });

  it('writes line cap, line join, and numeric stroke paint', async () => {
    selectFirst();
    await fixture.whenStable();

    commitSelect('Line cap', 'round');
    await fixture.whenStable();
    expect(session.document()!.objects[0].style.strokeLinecap).toBe('round');
    expect(session.history().entries.at(-1)?.label).toBe('Set line cap');

    commitSelect('Line join', 'bevel');
    await fixture.whenStable();
    expect(session.document()!.objects[0].style.strokeLinejoin).toBe('bevel');
    expect(session.history().entries.at(-1)?.label).toBe('Set line join');

    commitInput('Miter limit', '2');
    commitInput('Opacity', '0.5', 'enter');
    commitInput('Dash offset', '-3');
    await fixture.whenStable();

    expect(session.document()!.objects[0].style).toMatchObject({
      strokeMiterlimit: 2,
      strokeOpacity: 0.5,
      strokeDashoffset: -3,
    });
    expect(session.history().entries.at(-1)?.label).toBe('Set dash offset');
    expect(session.history().entries.map((entry) => entry.label)).toEqual([
      'New document',
      'Select',
      'Set line cap',
      'Set line join',
      'Set miter limit',
      'Set stroke opacity',
      'Set dash offset',
    ]);
  });

  it('writes a dash array and clears it back to none', async () => {
    selectFirst();
    await fixture.whenStable();

    commitInput('Dash array', '4, 1 2');
    await fixture.whenStable();
    expect(session.document()!.objects[0].style.strokeDasharray).toEqual([4, 1, 2]);
    expect(session.history().entries.at(-1)?.label).toBe('Set dash array');

    commitInput('Dash array', '');
    await fixture.whenStable();
    expect(session.document()!.objects[0].style.strokeDasharray).toBeNull();
  });

  it('skips invalid paint, a matching value, and an untouched mixed field', async () => {
    const first = selectFirst();
    await fixture.whenStable();
    const recorded = session.history().entries.length;

    commitInput('Miter limit', '0.5');
    commitInput('Opacity', '1.5');
    commitInput('Dash array', '4 -1');
    commitInput('Miter limit', '4');
    await fixture.whenStable();
    expect(session.history().entries).toHaveLength(recorded);
    expect(session.document()!.objects[0].style).toMatchObject({
      strokeMiterlimit: 4,
      strokeOpacity: 1,
      strokeDasharray: null,
    });

    bus.dispatch({ type: 'style.set', objectIds: [first], strokeDasharray: [1, 1] });
    await fixture.whenStable();
    bus.dispatch({ type: 'object.duplicate', ids: [first] });
    const second = session.document()!.objects[1].id;
    bus.dispatch({ type: 'style.set', objectIds: [second], strokeLinecap: 'square' });
    bus.dispatch({ type: 'style.set', objectIds: [second], strokeDasharray: [8, 2] });
    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [first, second],
      op: 'replace',
    });
    await fixture.whenStable();

    expect(select('Line cap').value).toBe('');
    expect(select('Line cap').textContent).toContain('Mixed');
    expect(input('Dash array').value).toBe('');
    const before = session.history().entries.length;
    input('Dash array').dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(session.history().entries).toHaveLength(before);
    expect(session.document()!.objects[0].style.strokeDasharray).toEqual([1, 1]);
    expect(session.document()!.objects[1].style.strokeDasharray).toEqual([8, 2]);

    commitSelect('Line cap', 'round');
    await fixture.whenStable();
    expect(
      session.document()!.objects.every((object) => object.style.strokeLinecap === 'round'),
    ).toBe(true);
  });

  function selectFirst(): string {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    return id;
  }

  function input(name: string): HTMLInputElement {
    const control = labeled(name);
    if (!(control instanceof HTMLInputElement)) {
      throw new Error(`${name} field is missing`);
    }
    return control;
  }

  function select(name: string): HTMLSelectElement {
    const control = labeled(name);
    if (!(control instanceof HTMLSelectElement)) {
      throw new Error(`${name} field is missing`);
    }
    return control;
  }

  function labeled(name: string): Element {
    const labels = [...fixture.nativeElement.querySelectorAll('label')];
    const label = labels.find((item) => item.childNodes[0]?.textContent?.trim() === name);
    const control = label?.querySelector('input, select');
    if (!control) {
      throw new Error(`${name} field is missing`);
    }
    return control;
  }

  function commitValue(value: string): void {
    commitInput('Stroke width', value);
  }

  function commitInput(name: string, value: string, key: 'blur' | 'enter' = 'blur'): void {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    if (key === 'enter') {
      field.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      return;
    }
    field.dispatchEvent(new FocusEvent('blur'));
  }

  function commitSelect(name: string, value: string): void {
    const field = select(name);
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
