import { Component, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { EditorTool } from '@vector-editor/commands/command';
import { CommandBus } from '@vector-editor/commands';
import { EDITOR_TOOLS } from '@vector-editor/commands/editor-tools';
import { SharedModule } from '@vector-editor/shared';


@Component({
  selector: 'app-tools-panel',
  imports: [SharedModule],
  templateUrl: './tools-panel.html',
})
export class ToolsPanel {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);

  public readonly panelName = 'Tools';

  protected readonly tools = EDITOR_TOOLS;
  protected readonly activeTool = this.session.tool;

  protected select(tool: EditorTool): void {
    this.bus.dispatch({ type: 'session.setTool', tool });
  }
}
