import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, computed, inject } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import {
  evaluateDocument,
  SessionService,
} from '@vector-editor/core';
import { isEmptyPoint } from '@vector-editor/modules/empty-point';
import { defaultTraceSettings } from '@vector-editor/modules/image-trace';
import { isImage } from '@vector-editor/modules/image/image';
import { ModifierKind } from '@vector-editor/modules/modifier-edits';
import { Modifier } from '@vector-editor/modules/types';
import { traceImageContent } from '@vector-editor/viewport';

@Component({
  selector: 'app-modifiers-panel',
  standalone: false,
  templateUrl: './modifiers-panel.html',
  styleUrl: './modifiers-panel.scss',
})
export class ModifiersPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);
  private tracing = false;

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

  protected readonly emptyPoint = computed(() => {
    const object = this.active();
    return object !== null && isEmptyPoint(object);
  });

  protected readonly image = computed(() => {
    const object = this.active();
    return object !== null && isImage(object);
  });

  protected readonly objects = computed(() => this.session.document()?.objects ?? []);

  protected readonly addKinds = computed(() => {
    if (this.image()) {
      return [{ kind: 'trace' as const, label: 'Image to vector' }];
    }
    return [
      { kind: 'array' as const, label: 'Array' },
      { kind: 'mirror' as const, label: 'Mirror' },
      { kind: 'bevel' as const, label: 'Bevel' },
      { kind: 'round' as const, label: 'Round' },
      { kind: 'boolean' as const, label: 'Boolean' },
    ];
  });

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

  protected async add(kind: ModifierKind): Promise<void> {
    const object = this.active();
    if (!object) {
      return;
    }
    if (kind !== 'trace') {
      this.bus.dispatch({ type: 'modifier.add', objectId: object.id, kind });
      return;
    }
    if (this.tracing || !object.image) {
      return;
    }
    this.tracing = true;
    try {
      const traced = await traceImageContent(object.image, defaultTraceSettings);
      const current = this.active();
      if (!current || current.id !== object.id || !isImage(current)) {
        return;
      }
      this.bus.dispatch({
        type: 'modifier.add',
        objectId: current.id,
        kind: 'trace',
        trace: {
          regions: traced.regions,
          ...(traced.fault ? { fault: traced.fault } : {}),
        },
      });
    } finally {
      this.tracing = false;
    }
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
