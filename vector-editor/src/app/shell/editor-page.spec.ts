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

  function objectName(name: string): HTMLElement {
    const label = [...fixture.nativeElement.querySelectorAll('.object-name')].find(
      (item) => item.textContent?.trim() === name,
    );
    if (!(label instanceof HTMLElement)) {
      throw new Error(`${name} is missing`);
    }
    return label;
  }

  function colorInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector('app-color-panel input[type="color"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Color input is missing');
    }
    return input;
  }

  function preview(): Element {
    const svg = fixture.nativeElement.querySelector('app-preview-panel svg');
    if (!(svg instanceof Element)) {
      throw new Error('Preview is missing');
    }
    return svg;
  }

  function paintedPath(root: ParentNode): Element | null {
    return (
      [...root.querySelectorAll('path')].find(
        (item) => item.getAttribute('fill') !== 'none' || item.getAttribute('stroke') !== 'none',
      ) ?? null
    );
  }

  function layerNames(): HTMLInputElement[] {
    return [...fixture.nativeElement.querySelectorAll('.layer-name')].filter(
      (input): input is HTMLInputElement => input instanceof HTMLInputElement,
    );
  }

  function buttonByLabel(label: string): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(`[aria-label="${label}"]`);
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
    expect(buttonByText('Save').disabled).toBe(true);
    expect(buttonByText('Undo').disabled).toBe(false);
    expect(buttonByText('Redo').disabled).toBe(true);
  });

  it('paints fill and stroke on the canvas and in preview', async () => {
    buttonByText('New').click();
    await fixture.whenStable();
    objectName('Path')
      .closest('[role="treeitem"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    const color = colorInput();
    color.value = '#00ff00';
    color.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    expect(paintedPath(canvas())?.getAttribute('fill')).toBe('#00ff00');
    expect(paintedPath(preview())?.getAttribute('fill')).toBe('#00ff00');

    buttonByText('Stroke').click();
    await fixture.whenStable();
    expect(buttonByText('Stroke').getAttribute('aria-pressed')).toBe('true');
    buttonByText('Add swatch').click();
    await fixture.whenStable();
    const swatch = fixture.nativeElement.querySelector('[aria-label="Swatch"]');
    if (!(swatch instanceof HTMLButtonElement)) {
      throw new Error('Swatch is missing');
    }
    swatch.click();
    await fixture.whenStable();

    expect(paintedPath(canvas())?.getAttribute('stroke')).toBe('#00ff00');
    expect(paintedPath(preview())?.getAttribute('stroke')).toBe('#00ff00');
    expect(preview().querySelector('.anchor, .handle, .pen-preview')).toBeNull();
    expect(preview().getAttribute('aria-hidden')).toBe('true');
  });

  it('adds, renames, and reorders a layer, then hides the object', async () => {
    buttonByText('New').click();
    await fixture.whenStable();

    buttonByText('Add layer').click();
    await fixture.whenStable();
    const names = layerNames();
    expect(names[0]?.value).toBe('Layer 2');

    names[0].value = 'Ink';
    names[0].dispatchEvent(new Event('blur', { bubbles: true }));
    await fixture.whenStable();
    expect(layerNames()[0]?.value).toBe('Ink');

    buttonByLabel('Move Ink backward').click();
    await fixture.whenStable();
    expect(layerNames().map((input) => input.value)).toEqual(['Layer', 'Ink']);

    buttonByLabel('Hide Path').click();
    await fixture.whenStable();
    expect(paintedPath(canvas())).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Nothing to preview.');

    buttonByLabel('Lock Path').click();
    await fixture.whenStable();
    expect(buttonByLabel('Unlock Path').getAttribute('aria-pressed')).toBe('true');
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
