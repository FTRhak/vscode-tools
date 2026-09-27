import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../../../../commands/command-bus.service';
import { OutlinerPanel } from './outliner-panel';

describe('OutlinerPanel', () => {
  let fixture: ComponentFixture<OutlinerPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OutlinerPanel],
    }).compileComponents();
    fixture = TestBed.createComponent(OutlinerPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
  });

  it('selects the object from its row and with Enter', async () => {
    expect(fixture.nativeElement.textContent).toContain('No objects yet');

    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
    const id = session.document()!.objects[0].id;
    const row = objectRow('Path');

    row.click();
    await fixture.whenStable();
    expect(session.selectedObjectIds()).toEqual([id]);
    expect(row.getAttribute('aria-selected')).toBe('true');

    bus.dispatch({ type: 'session.select', target: 'object', ids: [], op: 'clear' });
    await fixture.whenStable();
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(session.selectedObjectIds()).toEqual([id]);
  });

  it('adds the second object when the row is shift-clicked', async () => {
    bus.dispatch({ type: 'document.new' });
    const first = session.document()!.objects[0].id;
    bus.dispatch({ type: 'object.duplicate', ids: [first] });
    await fixture.whenStable();
    const second = session.document()!.objects[1].id;

    objectRow('Path').click();
    objectRow('Path copy').dispatchEvent(
      new MouseEvent('click', { bubbles: true, shiftKey: true }),
    );
    await fixture.whenStable();

    expect(session.selectedObjectIds()).toEqual([first, second]);
    expect(session.activeObjectId()).toBe(second);
  });

  it('moves the roving tabindex to the next row', async () => {
    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();

    const layer = fixture.nativeElement.querySelector('[aria-level="1"]');
    if (!(layer instanceof HTMLElement)) {
      throw new Error('Layer row is missing');
    }
    layer.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(objectRow('Path').tabIndex).toBe(0);
    expect(layer.tabIndex).toBe(-1);
  });

  it('hides an object from its eye without selecting the row', async () => {
    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
    const eye = fixture.nativeElement.querySelector('[aria-label="Hide Path"]');
    if (!(eye instanceof HTMLButtonElement)) {
      throw new Error('Eye button is missing');
    }

    eye.click();
    await fixture.whenStable();

    expect(session.document()!.objects[0].visible).toBe(false);
    expect(session.selectedObjectIds()).toEqual([]);
    expect(eye.getAttribute('aria-label')).toBe('Show Path');
  });

  it('leaves the tree focus in place when an arrow is pressed in the layer name', async () => {
    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('.layer-name');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Layer name is missing');
    }

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(objectRow('Path').tabIndex).toBe(-1);
    expect(input.closest('[role="treeitem"]')?.getAttribute('tabindex')).toBe('0');
  });

  function objectRow(name: string): HTMLElement {
    const row = [...fixture.nativeElement.querySelectorAll('[role="treeitem"]')].find((item) => {
      const label = item.querySelector('.object-name');
      return item.getAttribute('aria-level') === '2' && label?.textContent?.trim() === name;
    });
    if (!(row instanceof HTMLElement)) {
      throw new Error(`${name} row is missing`);
    }
    return row;
  }
});
