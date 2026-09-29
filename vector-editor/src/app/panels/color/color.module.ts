import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { SharedModule } from '@vector-editor/shared';
import { ColorPanel } from './components';
import { ColorTarget } from './services/color-target';

@NgModule({
  declarations: [ColorPanel],
  exports: [ColorPanel],
  providers: [ColorTarget],
  imports: [CommonModule, FormField, SharedModule],
})
export class PanelColorModule {}
