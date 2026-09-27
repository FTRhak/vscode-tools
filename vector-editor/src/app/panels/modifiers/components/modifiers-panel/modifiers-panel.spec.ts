import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { ModifiersPanel } from './modifiers-panel';

describe('ModifiersPanel', () => {
  let fixture: ComponentFixture<ModifiersPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModifiersPanel],
    }).compileComponents();
    fixture = TestBed.createComponent(ModifiersPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
  });

  it('edits the active object stack from the panel', async () => {
    expect(fixture.nativeElement.textContent).toContain('Select an object.');

    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('No modifiers yet.');
    button('Add array').click();
    button('Add mirror').click();
    await fixture.whenStable();

    expect(session.document()!.objects[0].modifiers.map((modifier) => modifier.type)).toEqual([
      'array',
      'mirror',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Array');
    expect(fixture.nativeElement.textContent).toContain('Mirror');
    expect(countInput().value).toBe('3');

    const radios = [
      ...fixture.nativeElement.querySelectorAll('input[type="radio"]'),
    ] as HTMLInputElement[];
    radios[2]?.click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers[1]).toMatchObject({ axis: 'xy' });

    button('Apply Array').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers.map((modifier) => modifier.type)).toEqual([
      'mirror',
    ]);
    expect(session.document()!.objects[0].source.subpaths.length).toBeGreaterThan(1);
    expect(fixture.nativeElement.textContent).not.toContain('Array');

    button('Apply all').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No modifiers yet.');
  });

  function button(label: string): HTMLButtonElement {
    const match = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item): item is HTMLButtonElement =>
        item instanceof HTMLButtonElement &&
        (item.getAttribute('aria-label') === label || item.textContent?.trim() === label),
    );
    if (!match) {
      throw new Error(`${label} button is missing`);
    }
    return match;
  }

  function countInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector('input[type="number"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Count input is missing');
    }
    return input;
  }
});
