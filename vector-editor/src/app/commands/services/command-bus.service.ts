import { inject, Service } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { Command } from '../command';

/** Dispatches editor commands to the active session for application. */
@Service()
export class CommandBus {
  private readonly session = inject(SessionService);

  dispatch(command: Command): void {
    this.session.apply(command);
  }
}
