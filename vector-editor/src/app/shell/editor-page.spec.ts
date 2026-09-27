import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorPage } from './editor-page';

describe('EditorPage', () => {
  let fixture: ComponentFixture<EditorPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorPage],
    }).compileComponents();
    fixture = TestBed.createComponent(EditorPage);
    await fixture.whenStable();
  });

  function modeButton(): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector('.mode button');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Mode button is missing');
    }
    return button;
  }

  function canvas(): HTMLElement {
    const element = fixture.nativeElement.querySelector('[data-viewport]');
    if (!(element instanceof HTMLElement)) {
      throw new Error('Canvas is missing');
    }
    return element;
  }

  function buttonByText(label: string): HTMLButtonElement {
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`${label} button is missing`);
    }
    return button;
  }

  function pressedTools(label: string): HTMLButtonElement[] {
    return [...fixture.nativeElement.querySelectorAll('button')].filter(
      (button): button is HTMLButtonElement =>
        button instanceof HTMLButtonElement &&
        button.getAttribute('aria-pressed') === 'true' &&
        (button.getAttribute('aria-label') === label ||
          button.textContent?.includes(label) === true),
    );
  }

  it('renders the shell sections', () => {
    const headings = [...fixture.nativeElement.querySelectorAll('h2')].map((heading) =>
      heading.textContent?.trim(),
    );
    expect(headings).toEqual([
      'Outliner',
      'Options',
      'Modifiers',
      'Tools',
      'Color',
      'Color Collections',
      'Preview',
      'History',
    ]);
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Vector editor');
  });

  it('toggles the mode from the top bar button', async () => {
    expect(modeButton().textContent).toContain('Object');

    modeButton().click();
    await fixture.whenStable();

    expect(modeButton().textContent).toContain('Edit');
    expect(modeButton().getAttribute('aria-label')).toBe('Edit mode');
  });

  it('toggles the mode when Tab is pressed on the canvas and keeps focus there', async () => {
    const surface = canvas();
    expect(surface.tabIndex).toBe(0);
    expect(surface.getAttribute('aria-label')).toBe('Canvas');
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    surface.dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(modeButton().textContent).toContain('Edit');
  });

  it('leaves the mode unchanged when Tab is pressed in the panels', async () => {
    const pen = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Pen') === true,
    );
    if (!(pen instanceof HTMLButtonElement)) {
      throw new Error('Pen button is missing');
    }

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    pen.dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(false);
    expect(modeButton().textContent).toContain('Object');
  });

  it('changes the tool from the keyboard and from the tools panel', async () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(pressedTools('Pen')).toHaveLength(2);

    const direct = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Direct select') === true,
    );
    if (!(direct instanceof HTMLButtonElement)) {
      throw new Error('Direct select button is missing');
    }
    direct.click();
    await fixture.whenStable();

    expect(pressedTools('Direct select')).toHaveLength(2);
  });

  it('draws a curve after New and leaves the other file actions disabled', async () => {
    expect(canvas().querySelector('path')).toBeNull();
    expect(buttonByText('New').disabled).toBe(false);
    for (const label of ['Open', 'Save', 'Undo', 'Redo']) {
      expect(buttonByText(label).disabled).toBe(true);
    }

    buttonByText('New').click();
    await fixture.whenStable();

    expect(canvas().querySelector('.artboard')).not.toBeNull();
    expect(canvas().querySelector('path')?.getAttribute('d')).toContain('C ');
    expect(buttonByText('Open').disabled).toBe(true);
  });

  it('ignores tool shortcuts while typing in a field', async () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }),
    );
    input.remove();
    await fixture.whenStable();

    expect(pressedTools('Select')).toHaveLength(2);
  });
});
