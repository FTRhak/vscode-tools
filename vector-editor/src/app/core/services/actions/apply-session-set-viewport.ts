import { Command } from '@vector-editor/commands';
import { SessionSlice } from '@vector-editor/modules/types';

export function applySessionSetViewport(state: SessionSlice, command: Extract<Command, { type: 'session.setViewport' }>): SessionSlice {
  return new SessionSlice({
    ...state,
    viewport: { panX: command.panX, panY: command.panY, zoom: command.zoom },
  });
}
