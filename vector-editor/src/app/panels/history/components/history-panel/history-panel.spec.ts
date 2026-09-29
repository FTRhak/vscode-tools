import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { HistoryPanel } from './history-panel';

describe('HistoryPanel', () => {
  let fixture: ComponentFixture<HistoryPanel>;
  let session: SessionService;
  let bus: CommandBus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryPanel],
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryPanel);
    session = TestBed.inject(SessionService);
    bus = TestBed.inject(CommandBus);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.panel-accordion-header').click();
    await fixture.whenStable();
  });

  it('lists steps oldest first and jumps without activating the current row', async () => {
    expect(fixture.nativeElement.textContent).toContain('No history yet.');

    bus.dispatch({ type: 'document.new' });
    const id = session.document()!.objects[0].id;
    bus.dispatch({ type: 'session.select', target: 'object', ids: [id], op: 'replace' });
    bus.dispatch({ type: 'object.setTransform', ids: [id], transform: { x: 10 } });
    bus.dispatch({ type: 'history.undo' });
    await fixture.whenStable();

    const buttons = [...fixture.nativeElement.querySelectorAll('[role="option"]')] as HTMLElement[];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'New document',
      'Select',
      'Set transform',
    ]);
    expect(buttons[1].getAttribute('aria-selected')).toBe('true');
    expect(buttons[0].classList.contains('is-future')).toBe(false);
    expect(buttons[2].classList.contains('is-future')).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('No history yet.');

    const documentAtSelect = session.document();
    buttons[1].click();
    await fixture.whenStable();
    expect(session.history().index).toBe(1);
    expect(session.document()).toBe(documentAtSelect);

    buttons[0].click();
    await fixture.whenStable();
    expect(session.history().index).toBe(0);
    expect(session.selectedObjectIds()).toEqual([]);
    expect(session.document()!.objects[0].transform.x).toBe(0);

    buttons[2].click();
    await fixture.whenStable();
    expect(session.history().index).toBe(2);
    expect(session.document()!.objects[0].transform.x).toBe(10);
    expect(buttons[2].classList.contains('is-future')).toBe(false);
    expect(buttons[2].getAttribute('aria-selected')).toBe('true');
  });
});
