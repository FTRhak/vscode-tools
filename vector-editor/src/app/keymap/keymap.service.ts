import { DestroyRef, inject, Service } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '../commands/command-bus.service';
import { Command, EditorTool, oppositeMode } from '../commands/command';

const toolKeys: Readonly<Record<string, EditorTool>> = {
  v: 'select',
  a: 'direct-select',
  p: 'pen',
};

@Service()
export class KeymapService {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const onKeyDown = (event: KeyboardEvent) => {
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

  private commandFor(event: KeyboardEvent): Command | null {
    if (event.repeat || isTypingTarget(event.target)) {
      return null;
    }

    if (event.key === 'Tab') {
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return null;
      }
      if (!isViewportTarget(event.target)) {
        return null;
      }
      return { type: 'session.setMode', mode: oppositeMode(this.session.mode()) };
    }

    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return null;
    }

    const tool = toolKeys[event.key.toLowerCase()];
    return tool ? { type: 'session.setTool', tool } : null;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function isViewportTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.hasAttribute('data-viewport');
}
