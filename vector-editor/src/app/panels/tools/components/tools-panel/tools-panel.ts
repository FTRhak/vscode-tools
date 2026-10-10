import { Component, inject } from '@angular/core';
import { CommandBus, EDITOR_TOOLS_ICONS, editorToolGroups, EditorTool } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
import { ImagePlace } from '@vector-editor/viewport';

@Component({
  selector: 'app-tools-panel',
  standalone: false,
  templateUrl: './tools-panel.html',
  styleUrls: ['./tools-panel.scss'],
})
export class ToolsPanel {
  private readonly bus = inject(CommandBus);
  private readonly session = inject(SessionService);
  private readonly images = inject(ImagePlace);

  public readonly panelName = 'Tools';

  protected readonly groups = editorToolGroups();
  protected readonly icons = EDITOR_TOOLS_ICONS;
  protected readonly activeTool = this.session.tool;
  protected readonly linked = this.session.imagePlacement;

  protected select(tool: EditorTool): void {
    this.bus.dispatch({ type: 'session.setTool', tool });
    if (tool === 'image') {
      this.images.requestPick();
    }
  }

  protected setPlacement(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    this.bus.dispatch({
      type: 'session.setImagePlacement',
      placement: input.checked ? 'link' : 'embed',
    });
  }
}
