import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { SharedModule } from '@vector-editor/shared';
import { StrokePanel } from './components';


@NgModule({
  declarations: [StrokePanel],
  exports: [StrokePanel],
  imports: [CommonModule, SharedModule, FormField],
})
export class StrokeModule {}
