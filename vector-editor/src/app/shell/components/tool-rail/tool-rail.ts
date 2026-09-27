import { Component, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { EditorTool } from '@vector-editor/commands/command';
import { EDITOR_TOOLS } from '@vector-editor/commands/editor-tools';

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
