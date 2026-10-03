import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@vector-editor/shared';
import { ToolButton, ToolIcon, ToolsPanel } from './components';

@NgModule({
  declarations: [ToolsPanel, ToolButton],
  exports: [ToolsPanel],
  imports: [CommonModule, SharedModule, ToolIcon],
})
export class ToolsModule {}
