import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from '@vector-editor/shared';
import { ColorPanel, GradientEditor } from './components';
import { ColorTarget } from './services/color-target';

@NgModule({
  declarations: [ColorPanel],
  exports: [ColorPanel],
  providers: [ColorTarget],
  imports: [CommonModule, SharedModule, GradientEditor],
})
export class PanelColorModule {}
