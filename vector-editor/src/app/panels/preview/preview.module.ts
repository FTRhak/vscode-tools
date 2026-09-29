import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from '@vector-editor/shared';
import { PreviewInfo, PreviewPanel, PreviewSvg } from './components';

@NgModule({
  declarations: [PreviewPanel, PreviewInfo, PreviewSvg],
  exports: [PreviewPanel],
  imports: [CommonModule, SharedModule],
})
export class PanelPreviewModule {}
