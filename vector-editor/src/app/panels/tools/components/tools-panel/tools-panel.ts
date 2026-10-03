import { Component, inject } from '@angular/core';
import {
  CommandBus,
  EDITOR_TOOLS_ICONS,
  editorToolGroups,
  EditorTool,
} from '@vector-editor/commands';
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

  protected readonly groups = editorToolGroups();
  protected readonly icons = EDITOR_TOOLS_ICONS;
  protected readonly activeTool = this.session.tool;

  protected select(tool: EditorTool): void {
    this.bus.dispatch({ type: 'session.setTool', tool });
  }
}
