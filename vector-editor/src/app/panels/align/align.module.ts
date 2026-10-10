import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@vector-editor/shared';
import { AlignPanel } from './components';

@NgModule({
  declarations: [AlignPanel],
  exports: [AlignPanel],
  imports: [CommonModule, SharedModule],
})
export class AlignModule {}
