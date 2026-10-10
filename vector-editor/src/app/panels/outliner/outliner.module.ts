import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@vector-editor/shared';
import { OutlinerLayerRow, OutlinerObjectRow, OutlinerPanel } from './components';

@NgModule({
  declarations: [OutlinerPanel, OutlinerObjectRow, OutlinerLayerRow],
  exports: [OutlinerPanel],
  imports: [CommonModule, SharedModule],
})
export class OutlinerModule {}
