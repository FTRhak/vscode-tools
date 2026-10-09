import { CdkDrag, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkMenuModule } from '@angular/cdk/menu';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { SharedModule } from '@vector-editor/shared';
import { ArrayModifierFields, BevelModifierFields, BooleanModifierFields, MirrorModifierFields, ModifierRow, ModifiersPanel, RoundModifierFields, TraceModifierFields } from './components';

@NgModule({
  declarations: [
    ModifiersPanel,
    ArrayModifierFields,
    BevelModifierFields,
    BooleanModifierFields,
    RoundModifierFields,
    TraceModifierFields,
    ModifierRow,
    MirrorModifierFields,
  ],
  exports: [ModifiersPanel],
  imports: [
    CommonModule,
    SharedModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkMenuModule,
    FormField,
  ],
})
export class PanelModifiersModule {}
