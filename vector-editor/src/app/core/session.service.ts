import { computed, Service, signal } from '@angular/core';
import { Command, EditorMode, EditorTool } from '../commands/command';
import { createNewDocument } from './model/create-document';
import { Document, ViewportCamera } from './model/types';

export interface SessionSlice {
  readonly mode: EditorMode;
  readonly tool: EditorTool;
  readonly document: Document | null;
  readonly viewport: ViewportCamera;
}

const initialSession: SessionSlice = {
  mode: 'object',
  tool: 'select',
  document: null,
  viewport: { panX: 0, panY: 0, zoom: 1 },
};

export function applySessionCommand(state: SessionSlice, command: Command): SessionSlice {
  switch (command.type) {
    case 'session.setMode':
      return { ...state, mode: command.mode };
    case 'session.setTool':
      return { ...state, tool: command.tool };
    case 'document.new':
      return { ...state, document: createNewDocument() };
    case 'session.setViewport':
      return {
        ...state,
        viewport: { panX: command.panX, panY: command.panY, zoom: command.zoom },
      };
  }
}

@Service()
export class SessionService {
  private readonly state = signal<SessionSlice>(initialSession);

  readonly mode = computed(() => this.state().mode);
  readonly tool = computed(() => this.state().tool);
  readonly document = computed(() => this.state().document);
  readonly viewport = computed(() => this.state().viewport);

  apply(command: Command): void {
    this.state.update((current) => applySessionCommand(current, command));
  }
}
