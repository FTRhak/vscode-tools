import { Component, inject } from '@angular/core';
import { CommandBus, EDITOR_TOOLS, EditorTool } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';

@Component({
  selector: 'app-tool-rail',
  templateUrl: './tool-rail.html',
  styleUrl: './tool-rail.scss',
})
export class ToolRail {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);

  protected readonly tools = EDITOR_TOOLS;
  protected readonly activeTool = this.session.tool;

  protected select(tool: EditorTool): void {
    this.bus.dispatch({ type: 'session.setTool', tool });
  }
}
