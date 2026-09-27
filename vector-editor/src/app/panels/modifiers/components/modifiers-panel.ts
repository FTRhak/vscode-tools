import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, inject } from '@angular/core';
import { evaluateDocument, Modifier, SessionService } from '@vector-editor/core';
import { CommandBus } from '../../../commands/command-bus.service';
import { ModifierRow } from './modifier-row';

@Component({
  selector: 'app-modifiers-panel',
  imports: [CdkDropList, CdkDrag, ModifierRow],
  templateUrl: './modifiers-panel.html',
  styleUrl: './modifiers-panel.scss',
})
export class ModifiersPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);

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

  protected add(kind: 'array' | 'mirror' | 'bevel' | 'boolean'): void {
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
