import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBus } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
import { AlignPanel } from './align-panel';

describe('AlignPanel', () => {
  let fixture: ComponentFixture<AlignPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlignPanel],
    }).compileComponents();
    fixture = TestBed.createComponent(AlignPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.panel-accordion-header').click();
    await fixture.whenStable();
  });

  it('disables align until enough objects are selected', async () => {
    expect(fixture.nativeElement.textContent).toContain('Nothing selected.');
    expect(alignButton('Align left').disabled).toBe(true);

    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Select two or more objects.');
    expect(alignButton('Align left').disabled).toBe(true);
    expect(alignTo().value).toBe('selection');
  });

  it('aligns one object to the artboard', async () => {
    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    await fixture.whenStable();

    alignTo().value = 'artboard';
    alignTo().dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('Nothing selected.');
    expect(fixture.nativeElement.textContent).not.toContain('Select two or more objects.');
    expect(alignButton('Align left').disabled).toBe(false);

    const before = session.document()!.objects[0].transform.x;
    alignButton('Align left').click();
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform.x).toBeLessThan(before);
    expect(session.history().entries.at(-1)?.label).toBe('Align left');
    expect(session.selectedObjectIds()).toEqual([id]);
  });

  it('aligns two selected objects and leaves a locked object in place', async () => {
    bus.dispatch({ type: 'document.new' });
    const original = session.document()!.objects[0];
    bus.dispatch({ type: 'object.duplicate', ids: [original.id] });
    const copyId = session.document()!.objects[1].id;
    bus.dispatch({ type: 'object.setFlags', ids: [copyId], locked: true });
    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [original.id, copyId],
      op: 'replace',
    });
    await fixture.whenStable();

    expect(alignButton('Align top').disabled).toBe(true);

    bus.dispatch({ type: 'object.setFlags', ids: [copyId], locked: false });
    await fixture.whenStable();
    const copyY = session.document()!.objects[1].transform.y;
    alignButton('Align top').click();
    await fixture.whenStable();

    expect(session.history().entries.at(-1)?.label).toBe('Align top');
    expect(session.document()!.objects[1].transform.y).not.toBe(copyY);
    expect(session.document()!.objects[1].locked).toBe(false);

    bus.dispatch({ type: 'object.setFlags', ids: [copyId], locked: true });
    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [original.id, copyId],
      op: 'replace',
    });
    const recorded = session.history().entries.length;
    const lockedY = session.document()!.objects[1].transform.y;
    await fixture.whenStable();
    alignButton('Align top').click();
    await fixture.whenStable();

    expect(session.document()!.objects[1].transform.y).toBe(lockedY);
    expect(session.history().entries).toHaveLength(recorded);
  });

  it('aligns the other object to the first selected object', async () => {
    bus.dispatch({ type: 'document.new' });
    const original = session.document()!.objects[0];
    bus.dispatch({ type: 'object.duplicate', ids: [original.id] });
    const copyId = session.document()!.objects[1].id;
    bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [copyId, original.id],
      op: 'replace',
    });
    await fixture.whenStable();

    alignTo().value = 'first';
    alignTo().dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    expect(alignButton('Align left').disabled).toBe(false);
    const copyX = session.document()!.objects[1].transform.x;
    alignButton('Align left').click();
    await fixture.whenStable();

    expect(session.document()!.objects[0].transform.x).toBe(copyX);
    expect(session.document()!.objects[1].transform.x).toBe(copyX);
    expect(session.history().entries.at(-1)?.label).toBe('Align left');
  });

  function alignButton(label: string): HTMLButtonElement {
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item) => item instanceof HTMLButtonElement && item.getAttribute('aria-label') === label,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`${label} button is missing`);
    }
    return button;
  }

  function alignTo(): HTMLSelectElement {
    const select = fixture.nativeElement.querySelector('select');
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Align to select is missing');
    }
    return select;
  }
});
