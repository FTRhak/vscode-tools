import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { OutlinerModule } from '../../outliner.module';
import { OutlinerPanel } from './outliner-panel';

describe('OutlinerPanel', () => {
  let fixture: ComponentFixture<OutlinerPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OutlinerModule],
    }).compileComponents();
    fixture = TestBed.createComponent(OutlinerPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
    openPanel();
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

  it('selects a layer and adds a path on it', async () => {
    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
    const firstId = session.document()!.layers[0].id;
    expect(session.selectedLayerId()).toBe(firstId);
    expect(layerItem(firstId).getAttribute('aria-selected')).toBe('true');

    bus.dispatch({ type: 'layer.add' });
    await fixture.whenStable();
    const secondId = session.selectedLayerId();
    expect(secondId).not.toBe(firstId);
    expect(layerItem(secondId!).getAttribute('aria-selected')).toBe('true');

    layerRow(firstId).click();
    await fixture.whenStable();
    expect(session.selectedLayerId()).toBe(firstId);

    addPathButton().click();
    await fixture.whenStable();
    const created = session.document()!.objects.at(-1);
    expect(created).toMatchObject({ name: 'Path 2', layerId: firstId });
    expect(session.selectedObjectIds()).toEqual([created!.id]);
    expect(objectRow('Path 2').getAttribute('aria-selected')).toBe('true');

    bus.dispatch({ type: 'layer.update', id: firstId, locked: true });
    await fixture.whenStable();
    expect(addPathButton().disabled).toBe(true);
  });

  it('collapses a layer from its twist without changing the selected layer', async () => {
    bus.dispatch({ type: 'document.new' });
    bus.dispatch({ type: 'layer.add' });
    await fixture.whenStable();
    const selectedId = session.selectedLayerId();
    const firstId = session.document()!.layers[0].id;
    const twist = layerItem(firstId).querySelector('.twist');
    if (!(twist instanceof HTMLButtonElement)) {
      throw new Error('Twist is missing');
    }

    twist.click();
    await fixture.whenStable();

    expect(session.selectedLayerId()).toBe(selectedId);
    expect(layerItem(firstId).getAttribute('aria-expanded')).toBe('false');
    expect(layerItem(firstId).querySelector('.object-name')).toBeNull();
  });

  it('selects the focused layer with Enter', async () => {
    bus.dispatch({ type: 'document.new' });
    bus.dispatch({ type: 'layer.add' });
    await fixture.whenStable();
    const firstId = session.document()!.layers[0].id;
    const tree = fixture.nativeElement.querySelector('[role="tree"]');
    if (!(tree instanceof HTMLElement)) {
      throw new Error('Layer tree is missing');
    }

    tree.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    tree.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(session.selectedLayerId()).toBe(firstId);
    expect(layerItem(firstId).getAttribute('aria-selected')).toBe('true');
  });

  it('deletes the selected path from the button', async () => {
    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();
    expect(deleteButton().disabled).toBe(true);

    objectRow('Path').click();
    await fixture.whenStable();
    expect(deleteButton().disabled).toBe(false);

    deleteButton().click();
    await fixture.whenStable();

    expect(session.document()!.objects).toHaveLength(0);
    expect(session.selectedObjectIds()).toEqual([]);
    expect(deleteButton().disabled).toBe(true);
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
    const name = fixture.nativeElement.querySelector('.layer-name');
    if (!(name instanceof HTMLElement)) {
      throw new Error('Layer name is missing');
    }

    name.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('.layer-name');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Layer name input is missing');
    }

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(objectRow('Path').tabIndex).toBe(-1);
    expect(input.closest('[role="treeitem"]')?.getAttribute('tabindex')).toBe('0');
  });

  function openPanel(): void {
    const header = fixture.nativeElement.querySelector('.panel-accordion-header');
    if (!(header instanceof HTMLButtonElement)) {
      throw new Error('Outliner header is missing');
    }
    header.click();
  }

  function layerItem(id: string): HTMLElement {
    const item = fixture.nativeElement.querySelector(`[data-tree-key="layer:${id}"]`);
    if (!(item instanceof HTMLElement)) {
      throw new Error('Layer row is missing');
    }
    return item;
  }

  function layerRow(id: string): HTMLElement {
    const row = layerItem(id).querySelector('.layer-row');
    if (!(row instanceof HTMLElement)) {
      throw new Error('Layer row is missing');
    }
    return row;
  }

  function deleteButton(): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector('.delete-object');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Delete button is missing');
    }
    return button;
  }

  function addPathButton(): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector('.add-path');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Add path button is missing');
    }
    return button;
  }

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
