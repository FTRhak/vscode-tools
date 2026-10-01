import { Component, inject } from '@angular/core';
import { CommandBus, EDITOR_TOOLS, EDITOR_TOOLS_ICONS, EditorTool } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';


@Component({
  selector: 'app-tools-panel',
  standalone: false,
  templateUrl: './tools-panel.html',
  styleUrls: ['./tools-panel.scss'],
})
export class ToolsPanel {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);

  public readonly panelName = 'Tools';

  protected readonly tools = EDITOR_TOOLS;
  protected readonly icons = EDITOR_TOOLS_ICONS;
  protected readonly activeTool = this.session.tool;

  protected iconFor(tool: EditorTool): string {
    return this.icons[tool];
  }

  protected select(tool: EditorTool): void {
    this.bus.dispatch({ type: 'session.setTool', tool });
  }
}
