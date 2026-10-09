import { Component, inject } from '@angular/core';
import { KeymapService } from '@vector-editor/keymap';
import { AlignPanel } from '@vector-editor/panels/align';
import { PanelColorModule } from '@vector-editor/panels/color';
import { HistoryPanel } from '@vector-editor/panels/history';
import { PanelModifiersModule } from '@vector-editor/panels/modifiers';
import { PanelOptionsModule } from '@vector-editor/panels/options';
import { OutlinerModule } from '@vector-editor/panels/outliner';
import { PanelPreviewModule } from '@vector-editor/panels/preview';
import { StrokePanel } from '@vector-editor/panels/stroke';
import { SwatchesPanel } from '@vector-editor/panels/swatches';
import { ToolsModule } from '@vector-editor/panels/tools';
import { Viewport } from '@vector-editor/viewport';
import { NewDocumentDialog } from '../new-document-dialog/new-document-dialog';
import { SaveDialog } from '../save-dialog/save-dialog';
import { ToolRail } from '../tool-rail/tool-rail';
import { TopBar } from '../top-bar/top-bar';

@Component({
  selector: 'app-editor-page',
  imports: [
    TopBar,
    ToolRail,
    NewDocumentDialog,
    SaveDialog,
    Viewport,
    OutlinerModule,
    PanelOptionsModule,
    AlignPanel,
    PanelModifiersModule,
    ToolsModule,
    PanelColorModule,
    StrokePanel,
    SwatchesPanel,
    PanelPreviewModule,
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
