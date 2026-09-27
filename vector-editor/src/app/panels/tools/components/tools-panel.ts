import { Component, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { EditorTool } from '../../../commands/command';
import { CommandBus } from '../../../commands/command-bus.service';
import { EDITOR_TOOLS } from '../../../commands/editor-tools';

@Component({
  selector: 'app-tools-panel',
  templateUrl: './tools-panel.html',
})
export class ToolsPanel {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);

  protected readonly tools = EDITOR_TOOLS;
  protected readonly activeTool = this.session.tool;

  protected select(tool: EditorTool): void {
    this.bus.dispatch({ type: 'session.setTool', tool });
  }
}
