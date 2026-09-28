import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, inject } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import { evaluateDocument, Modifier, SessionService } from '@vector-editor/core';
import { SharedModule } from '@vector-editor/shared';
import { ModifierRow } from '../modifier-row/modifier-row';
import { ModifierKind } from '../../../../core/model/modifier-edits';
import {CdkMenuModule} from '@angular/cdk/menu';

@Component({
  selector: 'app-modifiers-panel',
  imports: [CdkDropList, CdkDrag, ModifierRow, CdkMenuModule, SharedModule],
  templateUrl: './modifiers-panel.html',
  styleUrl: './modifiers-panel.scss',
})
export class ModifiersPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);

  public readonly panelName = 'Modifiers';

  protected readonly active = computed(() => {
    const document = this.session.document();
    const id = this.session.activeObjectId();
    if (!document || !id) {
      return null;
    }
    return document.objects.find((object) => object.id === id) ?? null;
  });

  protected readonly modifiers = computed(() => this.active()?.modifiers ?? []);

  protected readonly objects = computed(() => this.session.document()?.objects ?? []);

  protected readonly diagnostics = computed(() => {
    const document = this.session.document();
    const object = this.active();
    if (!document || !object) {
      return [];
    }
    return (
      evaluateDocument(document.objects, this.session.clipperHold()).find(
        (item) => item.objectId === object.id,
      )?.diagnostics ?? []
    );
  });

  protected add(kind: ModifierKind): void {
    const object = this.active();
    if (!object) {
      return;
    }
    this.bus.dispatch({ type: 'modifier.add', objectId: object.id, kind });
  }

  protected applyAll(): void {
    const object = this.active();
    if (!object) {
      return;
    }
    this.bus.dispatch({ type: 'modifier.applyAll', objectId: object.id });
  }

  protected reorder(event: CdkDragDrop<readonly Modifier[]>): void {
    const object = this.active();
    const modifier = this.modifiers()[event.previousIndex];
    if (!object || !modifier || event.previousIndex === event.currentIndex) {
      return;
    }
    this.bus.dispatch({
      type: 'modifier.reorder',
      objectId: object.id,
      modifierId: modifier.id,
      index: event.currentIndex,
    });
  }
}
