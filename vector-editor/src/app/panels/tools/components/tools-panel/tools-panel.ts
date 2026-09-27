import { Component, inject } from '@angular/core';
import { CommandBus, EDITOR_TOOLS, EditorTool } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
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
