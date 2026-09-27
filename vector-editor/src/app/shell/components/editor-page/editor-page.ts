import { Component, inject } from '@angular/core';
import { KeymapService } from '@vector-editor/keymap';
import { Viewport } from '@vector-editor/viewport';
import { ColorPanel } from '@vector-editor/panels/color';
import { HistoryPanel } from '@vector-editor/panels/history';
import { ModifiersPanel } from '@vector-editor/panels/modifiers';
import { OptionsPanel } from '@vector-editor/panels/options';
import { OutlinerPanel } from '@vector-editor/panels/outliner';
import { PreviewPanel } from '@vector-editor/panels/preview';
import { SwatchesPanel } from '@vector-editor/panels/swatches';
import { ToolsPanel } from '@vector-editor/panels/tools';
import { TopBar } from '../top-bar/top-bar';
import { ToolRail } from '../tool-rail/tool-rail';
import { SaveDialog } from '../save-dialog/save-dialog';

@Component({
  selector: 'app-editor-page',
  imports: [
    TopBar,
    ToolRail,
    SaveDialog,
    Viewport,
    OutlinerPanel,
    OptionsPanel,
    ModifiersPanel,
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
