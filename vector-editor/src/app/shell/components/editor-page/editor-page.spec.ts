import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBus } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
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

  async function createDocument(): Promise<void> {
    buttonByText('New').click();
    await fixture.whenStable();
    buttonByText('Create').click();
    await fixture.whenStable();
  }

  function buttonByText(label: string): HTMLButtonElement {
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`${label} button is missing`);
    }
    return button;
  }

  function objectName(name: string): HTMLElement {
    const label = [...fixture.nativeElement.querySelectorAll('.object-name')].find((item) => item.textContent?.trim() === name);
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
    const surface = root instanceof Element && root.matches('[data-viewport]') ? root.querySelector(':scope > svg') : root;
    if (!surface) {
      return null;
    }
    return (
      [...surface.querySelectorAll('path')].find(
        (item) => item.getAttribute('fill') !== 'none' || item.getAttribute('stroke') !== 'none',
      ) ?? null
    );
  }

  function layerNameLabels(): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('.layer-name')].filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
  }

  function layerNameText(): string[] {
    return layerNameLabels().map((element) => (element instanceof HTMLInputElement ? element.value : (element.textContent?.trim() ?? '')));
  }

  function openPanel(name: string): void {
    const header = fixture.nativeElement.querySelector(`.${name}-accordion-item .panel-accordion-header`);
    if (!(header instanceof HTMLButtonElement)) {
      throw new Error(`${name} header is missing`);
    }
    if (header.getAttribute('aria-expanded') !== 'true') {
      header.click();
    }
  }

  function buttonByTitle(title: string): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(`[title="${title}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`${title} button is missing`);
    }
    return button;
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
        (button.getAttribute('aria-label') === label || button.textContent?.includes(label) === true),
    );
  }

  it('renders the shell sections', () => {
    const headings = [...fixture.nativeElement.querySelectorAll('h2')].map((heading) =>
      [...heading.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .filter((text) => text.length > 0)
        .join(' '),
    );
    expect(headings).toEqual([
      'Outliner',
      'Options',
      'Align',
      'Modifiers',
      'Tools',
      'Color',
      'Stroke',
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
    const pen = [...fixture.nativeElement.querySelectorAll('button')].find((button) => button.textContent?.includes('Pen') === true);
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
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true }));
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

  it('draws a curve after New and enables Save', async () => {
    expect(canvas().querySelector('path')).toBeNull();
    expect(buttonByText('New').disabled).toBe(false);
    expect(buttonByText('Open').disabled).toBe(false);
    expect(buttonByText('Save').disabled).toBe(true);
    expect(buttonByText('Undo').disabled).toBe(true);
    expect(buttonByText('Redo').disabled).toBe(true);

    await createDocument();

    expect(canvas().querySelector('.artboard')).not.toBeNull();
    expect(canvas().querySelector('path')?.getAttribute('d')).toContain('C ');
    expect(buttonByText('Open').disabled).toBe(false);
    expect(buttonByText('Save').disabled).toBe(false);
    expect(buttonByText('Undo').disabled).toBe(false);
    expect(buttonByText('Redo').disabled).toBe(true);
  });

  it('asks for a size and creates that view box', async () => {
    buttonByText('New').click();
    await fixture.whenStable();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Width');
    expect(dialog?.textContent).toContain('Height');
    const width = dialog?.querySelector('#document-width');
    const height = dialog?.querySelector('#document-height');
    if (!(width instanceof HTMLInputElement) || !(height instanceof HTMLInputElement)) {
      throw new Error('Size fields are missing');
    }
    expect(width.value).toBe('1200');
    expect(height.value).toBe('800');

    width.value = '640';
    width.dispatchEvent(new Event('input', { bubbles: true }));
    height.value = '480';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    buttonByText('Create').click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(TestBed.inject(SessionService).document()?.viewBox).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 480,
    });
    expect(document.activeElement).toBe(buttonByText('New'));
  });

  it('closes the new document dialog without creating', async () => {
    buttonByText('New').click();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(canvas().querySelector('.artboard')).toBeNull();
    expect(document.activeElement).toBe(buttonByText('New'));
  });

  it('opens the save dialog and closes it without writing', async () => {
    await createDocument();
    buttonByText('Save').click();
    await fixture.whenStable();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('All data');
    expect(dialog?.textContent).toContain('Optimized');
    expect(dialog?.textContent).toContain('Minimal');
    expect(dialog?.querySelector('input[type="radio"]:checked')?.parentElement?.textContent).toContain('All data');

    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(buttonByText('Save'));
  });

  it('paints fill and stroke on the canvas and in preview', async () => {
    await createDocument();
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

  it('shows gradients as previews in the swatch list', async () => {
    const bus = TestBed.inject(CommandBus);
    bus.dispatch({ type: 'document.new' });
    await fixture.whenStable();

    const session = TestBed.inject(SessionService);
    const objectId = session.document()!.objects[0].id;
    for (const type of ['linear', 'radial'] as const) {
      bus.dispatch({
        type: 'gradient.create',
        gradient: {
          name: type === 'linear' ? 'Sunset' : 'Spotlight',
          type,
          angle: 0,
          proportions: 1,
          stops: [
            { id: `${type}-start`, offset: 0, color: '#ff0000', opacity: 1 },
            { id: `${type}-end`, offset: 1, color: '#0000ff', opacity: 1 },
          ],
        },
        target: 'fill',
        objectIds: [objectId],
      });
      const gradient = session.document()!.gradients.at(-1)!;
      bus.dispatch({
        type: 'swatch.add',
        name: gradient.name,
        color: `url(#${gradient.id})`,
      });
    }
    await fixture.whenStable();

    expect(buttonByLabel('Sunset').style.background).toContain('linear-gradient');
    expect(buttonByLabel('Spotlight').style.background).toContain('radial-gradient');
  });

  it('adds, renames, and reorders a layer, then hides the object', async () => {
    await createDocument();
    openPanel('outliner');
    await fixture.whenStable();

    buttonByTitle('Add layer').click();
    await fixture.whenStable();
    expect(layerNameText()[0]).toBe('Layer 2');

    layerNameLabels()[0]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await fixture.whenStable();
    const input = layerNameLabels()[0];
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Layer name input is missing');
    }
    input.value = 'Ink';
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await fixture.whenStable();
    expect(layerNameText()[0]).toBe('Ink');

    buttonByLabel('Move Ink backward').click();
    await fixture.whenStable();
    expect(layerNameText()).toEqual(['Layer', 'Ink']);

    openPanel('preview');
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
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    input.remove();
    await fixture.whenStable();

    expect(pressedTools('Select')).toHaveLength(2);
  });
});
