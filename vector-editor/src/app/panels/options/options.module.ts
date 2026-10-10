import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { SharedModule } from '@vector-editor/shared';
import { OptionsPanel } from './components';
import { AnchorOptions } from './components/anchor-options/anchor-options';
import { ObjectOptions } from './components/object-options/object-options';

@NgModule({
  declarations: [OptionsPanel, AnchorOptions, ObjectOptions],
  exports: [OptionsPanel],
  imports: [CommonModule, SharedModule, FormField],
})
export class PanelOptionsModule {}
