import { TestBed } from '@angular/core/testing';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../commands/command-bus.service';
import { FileActions } from './file-actions.service';

describe('FileActions', () => {
  let files: FileActions;
  let session: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    files = TestBed.inject(FileActions);
    session = TestBed.inject(SessionService);
    TestBed.inject(CommandBus);
  });

  it('downloads the chosen save mode and returns focus to Save', () => {
    const bus = TestBed.inject(CommandBus);
    bus.dispatch({ type: 'document.new' });
    const button = document.createElement('button');
    button.dataset['fileSave'] = '';
    document.body.append(button);
    files.requestSave();
    files.confirmSave('minimal');

    expect(files.saveDialogOpen()).toBe(false);
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it('replaces the document from a chosen file and reports skipped nodes', async () => {
    const bus = TestBed.inject(CommandBus);
    bus.dispatch({ type: 'document.new' });
    const previous = session.document();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('File input is missing');
    }
    await chooseFile(
      input,
      new File(
        [
          `<svg viewBox="0 0 40 40">
            <rect x="0" y="0" width="10" height="10"/>
            <circle cx="20" cy="20" r="4"/>
            <text>Hi</text>
          </svg>`,
        ],
        'sample.svg',
        { type: 'image/svg+xml' },
      ),
    );

    expect(session.document()).not.toBe(previous);
    expect(session.document()?.objects).toHaveLength(2);
    expect(session.document()?.objects[0]?.source.subpaths[0]?.closed).toBe(true);
    expect(session.mode()).toBe('object');
    expect(files.status()).toBe('Skipped 1 nodes.');
    expect(session.history().entries.at(-1)?.label).toBe('Open');
  });

  it('keeps the current document when the file cannot be read', async () => {
    const bus = TestBed.inject(CommandBus);
    bus.dispatch({ type: 'document.new' });
    const previous = session.document();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('File input is missing');
    }
    await chooseFile(input, new File(['not svg'], 'notes.txt', { type: 'text/plain' }));

    expect(session.document()).toBe(previous);
    expect(files.status()).toBe('Could not read this SVG.');
  });
});

async function chooseFile(input: HTMLInputElement, file: File): Promise<void> {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: { 0: file, length: 1, item: () => file },
  });
  input.dispatchEvent(new Event('change'));
  await file.text();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
