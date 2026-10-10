import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { PanelModifiersModule } from '../../modifiers.module';
import { ModifiersPanel } from './modifiers-panel';

describe('ModifiersPanel', () => {
  let fixture: ComponentFixture<ModifiersPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelModifiersModule],
    }).compileComponents();
    fixture = TestBed.createComponent(ModifiersPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.panel-accordion-header').click();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('edits the active object stack from the panel', async () => {
    expect(fixture.nativeElement.textContent).toContain('Select an object.');

    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('No modifiers yet.');
    await addKind('Array');
    await addKind('Mirror');

    expect(session.document()!.objects[0].modifiers.map((modifier) => modifier.type)).toEqual(['array', 'mirror']);
    expect(fixture.nativeElement.textContent).toContain('Array');
    expect(fixture.nativeElement.textContent).toContain('Mirror');
    expect(countInput().value).toBe('3');

    button('X').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers[1]).toMatchObject({ axis: 'none' });

    button('Y').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers[1]).toMatchObject({ axis: 'y' });

    button('X').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers[1]).toMatchObject({ axis: 'xy' });

    button('Y').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers[1]).toMatchObject({ axis: 'x' });

    button('X').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers[1]).toMatchObject({ axis: 'none' });

    button('Apply Array').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers.map((modifier) => modifier.type)).toEqual(['mirror']);
    expect(session.document()!.objects[0].source.subpaths.length).toBeGreaterThan(1);
    expect(fixture.nativeElement.textContent).not.toContain('Array');

    button('Apply all').click();
    await fixture.whenStable();
    expect(session.document()!.objects[0].modifiers).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No modifiers yet.');
  });

  it('adds image to vector for an image', async () => {
    bus.dispatch({ type: 'document.new' });
    bus.dispatch({
      type: 'image.add',
      name: 'Photo',
      placement: 'embed',
      fileName: 'photo.png',
      mime: 'image/png',
      dataUrl: pixel,
      pixelWidth: 1,
      pixelHeight: 1,
      x: 2,
      y: 3,
      width: 8,
      height: 6,
      preserveAspectRatio: 'none',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    openMenu();
    const labels = [...document.body.querySelectorAll('button')].map((item) => item.textContent?.trim());
    expect(labels).toContain('Image to vector');
    expect(labels).not.toContain('Array');
    const item = [...document.body.querySelectorAll('button')].find(
      (entry): entry is HTMLButtonElement => entry instanceof HTMLButtonElement && entry.textContent?.trim() === 'Image to vector',
    );
    item?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 300));
    fixture.detectChanges();

    const image = session.document()!.objects.find((object) => object.kind === 'image');
    expect(image?.modifiers[0]).toMatchObject({ type: 'trace', mode: 'color', colors: 16 });
  });

  async function addKind(label: string): Promise<void> {
    openMenu();
    const item = [...document.body.querySelectorAll('button')].find(
      (entry): entry is HTMLButtonElement => entry instanceof HTMLButtonElement && entry.textContent?.trim() === label,
    );
    if (!item) {
      throw new Error(`${label} button is missing`);
    }
    item.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function openMenu(): void {
    const trigger = [...fixture.nativeElement.querySelectorAll('button')].find(
      (entry): entry is HTMLButtonElement => entry instanceof HTMLButtonElement && (entry.textContent?.includes('Add modifier') ?? false),
    );
    if (!trigger) {
      throw new Error('Add modifier button is missing');
    }
    trigger.click();
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const match = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item): item is HTMLButtonElement =>
        item instanceof HTMLButtonElement && (item.getAttribute('aria-label') === label || item.textContent?.trim() === label),
    );
    if (!match) {
      throw new Error(`${label} button is missing`);
    }
    return match;
  }

  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  function countInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector('input[type="number"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Count input is missing');
    }
    return input;
  }
});
