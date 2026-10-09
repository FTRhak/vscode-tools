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
    expect(widthInput().value).toBe('4');
  });

  it('writes the shared width on Enter and on blur', async () => {
    const id = selectFirst();
    await fixture.whenStable();

    const entered = widthInput();
    entered.value = '6';
    entered.dispatchEvent(new Event('input', { bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    entered.dispatchEvent(enter);
    await fixture.whenStable();

    expect(enter.defaultPrevented).toBe(true);
    expect(session.document()!.objects[0].style.strokeWidth).toBe(6);
    expect(session.history().entries.at(-1)?.label).toBe('Set stroke width');

    const blurred = widthInput();
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

    expect(widthInput().value).toBe('');
  });

  function selectFirst(): string {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    return id;
  }

  function widthInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector('input[type="number"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Stroke width field is missing');
    }
    return input;
  }

  function commitValue(value: string): void {
    const input = widthInput();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
  }
});
