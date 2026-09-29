import { Component, inject } from '@angular/core';
import { KeymapService } from '@vector-editor/keymap';
import { ColorPanel } from '@vector-editor/panels/color';
import { HistoryPanel } from '@vector-editor/panels/history';
import { PanelModifiersModule } from '@vector-editor/panels/modifiers';
import { PanelOptionsModule } from '@vector-editor/panels/options';
import { OutlinerPanel } from '@vector-editor/panels/outliner';
import { PreviewPanel } from '@vector-editor/panels/preview';
import { SwatchesPanel } from '@vector-editor/panels/swatches';
import { ToolsPanel } from '@vector-editor/panels/tools';
import { Viewport } from '@vector-editor/viewport';
import { SaveDialog } from '../save-dialog/save-dialog';
import { ToolRail } from '../tool-rail/tool-rail';
import { TopBar } from '../top-bar/top-bar';

@Component({
  selector: 'app-editor-page',
  imports: [
    TopBar,
    ToolRail,
    SaveDialog,
    Viewport,
    OutlinerPanel,
    PanelOptionsModule,
    PanelModifiersModule,
    ToolsPanel,
    ColorPanel,
    SwatchesPanel,
    PreviewPanel,
    HistoryPanel,
  ],
  templateUrl: './editor-page.html',
  styleUrl: './editor-page.scss',
})
export class EditorPage {
  constructor() {
    inject(KeymapService);
  }
}
