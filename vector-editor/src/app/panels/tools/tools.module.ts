import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@vector-editor/shared';
import { ToolButton, ToolsPanel } from './components';

@NgModule({
  declarations: [ToolsPanel, ToolButton],
  exports: [ToolsPanel],
  imports: [CommonModule, SharedModule],
})
export class ToolsModule {}
