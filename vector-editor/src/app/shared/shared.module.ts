import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkAccordionModule } from '@angular/cdk/accordion';
import { PanelComponent } from './components/panel/panel.component';

@NgModule({
  declarations: [PanelComponent],
  exports: [PanelComponent],
  imports: [CommonModule, CdkAccordionModule],
})
export class SharedModule {}
