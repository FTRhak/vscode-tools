import { Component, inject } from '@angular/core';
import { CommandBus, EDITOR_TOOLS_ICONS, editorToolGroups, EditorTool } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
import { ToolIcon } from '@vector-editor/panels/tools';

@Component({
  selector: 'app-tool-rail',
  imports: [ToolIcon],
  templateUrl: './tool-rail.html',
  styleUrl: './tool-rail.scss',
})
export class ToolRail {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);

  protected readonly groups = editorToolGroups();
  protected readonly icons = EDITOR_TOOLS_ICONS;
  protected readonly activeTool = this.session.tool;

  protected select(tool: EditorTool): void {
    this.bus.dispatch({ type: 'session.setTool', tool });
  }
}
