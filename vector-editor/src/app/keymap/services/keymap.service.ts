import { DestroyRef, inject, Service } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { Command, EditorTool, oppositeMode } from '@vector-editor/commands/command';
import { FileActions } from '../../shell/services/file-actions.service';

const toolKeys: Readonly<Record<string, EditorTool>> = {
  v: 'select',
  a: 'direct-select',
  p: 'pen',
};

@Service()
export class KeymapService {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);
  private readonly files = inject(FileActions);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) {
        return;
      }
      if (this.runFileShortcut(event)) {
        event.preventDefault();
        return;
      }
      const command = this.commandFor(event);
      if (!command) {
        return;
      }
      event.preventDefault();
      this.bus.dispatch(command);
    };

    this.document.addEventListener('keydown', onKeyDown);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('keydown', onKeyDown);
    });
  }

  private runFileShortcut(event: KeyboardEvent): boolean {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return false;
    }
    const key = event.key.toLowerCase();
    if (key === 'o') {
      this.files.openPicker();
      return true;
    }
    if (key === 's') {
      this.files.requestSave();
      return true;
    }
    return false;
  }

  private commandFor(event: KeyboardEvent): Command | null {
    if (event.key === 'Tab') {
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return null;
      }
      if (!isViewportTarget(event.target)) {
        return null;
      }
      return { type: 'session.setMode', mode: oppositeMode(this.session.mode()) };
    }

    const key = event.key.toLowerCase();
    if (event.ctrlKey && !event.altKey && !event.metaKey && key === 'z') {
      return event.shiftKey ? { type: 'history.redo' } : { type: 'history.undo' };
    }

    if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && key === 'd') {
      const ids = this.session.selectedObjectIds();
      if (ids.length === 0) {
        return null;
      }
      return { type: 'object.duplicate', ids };
    }

    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return null;
    }

    const penObjectId = this.session.penObjectId();
    if (event.key === 'Enter' && penObjectId && isViewportTarget(event.target)) {
      return { type: 'pen.finish', objectId: penObjectId, closed: false };
    }
    if (event.key === 'Escape' && penObjectId) {
      return { type: 'history.undo' };
    }

    if (this.session.mode() === 'edit' && (key === '1' || key === '2')) {
      return {
        type: 'session.setEditSelectionKind',
        kind: key === '1' ? 'anchor' : 'segment',
      };
    }

    if (key === 'h') {
      return this.toggleVisible();
    }

    if (key === 'delete' || key === 'x') {
      return this.deleteAnchors();
    }

    const tool = toolKeys[key];
    return tool ? { type: 'session.setTool', tool } : null;
  }

  private toggleVisible(): Command | null {
    const document = this.session.document();
    const ids = this.session.selectedObjectIds();
    if (!document || ids.length === 0) {
      return null;
    }
    const selected = new Set(ids);
    const objects = document.objects.filter((object) => selected.has(object.id));
    if (objects.length === 0) {
      return null;
    }
    return {
      type: 'object.setFlags',
      ids: objects.map((object) => object.id),
      visible: !objects.every((object) => object.visible),
    };
  }

  private deleteAnchors(): Command | null {
    if (this.session.mode() !== 'edit') {
      return null;
    }
    const objectId = this.session.activeObjectId();
    const anchorIds = this.session.selectedAnchorIds();
    if (!objectId || anchorIds.length === 0) {
      return null;
    }
    return { type: 'path.deleteAnchors', objectId, anchorIds };
  }
}

const nonTextInput = new Set(['button', 'checkbox', 'file', 'radio', 'range', 'reset', 'submit']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }
  return target instanceof HTMLInputElement && !nonTextInput.has(target.type);
}

function isViewportTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.hasAttribute('data-viewport');
}
