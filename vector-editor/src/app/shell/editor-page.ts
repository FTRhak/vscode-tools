import { Component, inject } from '@angular/core';
import { Viewport } from '@vector-editor/viewport';
import { ColorPanel } from '../panels/color';
import { HistoryPanel } from '../panels/history';
import { ModifiersPanel } from '../panels/modifiers';
import { OptionsPanel } from '../panels/options';
import { OutlinerPanel } from '../panels/outliner';
import { PreviewPanel } from '../panels/preview';
import { SwatchesPanel } from '../panels/swatches';
import { ToolsPanel } from '../panels/tools';
import { KeymapService } from '../keymap/keymap.service';
import { SaveDialog } from './save-dialog/save-dialog';
import { ToolRail } from './tool-rail/tool-rail';
import { TopBar } from './top-bar/top-bar';

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
