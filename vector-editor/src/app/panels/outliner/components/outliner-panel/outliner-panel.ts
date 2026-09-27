import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { layersFrontToBack, objectsOnLayer, SessionService } from '@vector-editor/core';
import { CommandBus } from '@vector-editor/commands';
import { SharedModule } from '@vector-editor/shared';


interface OutlinerObject {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly selected: boolean;
  readonly active: boolean;
}

interface OutlinerLayer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly expanded: boolean;
  readonly index: number;
  readonly canMoveForward: boolean;
  readonly canMoveBackward: boolean;
  readonly objects: readonly OutlinerObject[];
}

interface TreeRow {
  readonly key: string;
  readonly kind: 'layer' | 'object';
  readonly id: string;
}

@Component({
  selector: 'app-outliner-panel',
  imports: [SharedModule],
  templateUrl: './outliner-panel.html',
  styleUrl: './outliner-panel.scss',
})
export class OutlinerPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);
  private readonly host = inject(ElementRef<HTMLElement>);

  public readonly panelName = 'Outliner';

  private readonly collapsedLayerIds = signal<ReadonlySet<string>>(new Set());
  private readonly focusedKey = signal<string | null>(null);

  protected readonly hasDocument = computed(() => this.session.document() !== null);

  protected readonly layers = computed((): readonly OutlinerLayer[] => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const collapsed = this.collapsedLayerIds();
    const selected = new Set(this.session.selectedObjectIds());
    const activeId = this.session.activeObjectId();
    const layers = layersFrontToBack(document).map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      expanded: !collapsed.has(layer.id),
      objects: objectsOnLayer(document, layer.id)
        .slice()
        .reverse()
        .map((object) => ({
          id: object.id,
          name: object.name,
          visible: object.visible,
          locked: object.locked,
          selected: selected.has(object.id),
          active: object.id === activeId,
        })),
    }));
    return layers.map((layer, index) => ({
      ...layer,
      index,
      canMoveForward: index > 0,
      canMoveBackward: index < layers.length - 1,
    }));
  });

  private readonly focusableRows = computed((): readonly TreeRow[] => {
    const rows: TreeRow[] = [];
    for (const layer of this.layers()) {
      rows.push({ key: `layer:${layer.id}`, kind: 'layer', id: layer.id });
      if (!layer.expanded) {
        continue;
      }
      for (const object of layer.objects) {
        rows.push({ key: `object:${object.id}`, kind: 'object', id: object.id });
      }
    }
    return rows;
  });

  protected readonly activeFocusKey = computed(() => {
    const rows = this.focusableRows();
    const current = this.focusedKey();
    if (current && rows.some((row) => row.key === current)) {
      return current;
    }
    return rows[0]?.key ?? null;
  });

  protected addLayer(): void {
    this.bus.dispatch({ type: 'layer.add' });
  }

  protected toggleLayerFlag(layer: OutlinerLayer, flag: 'visible' | 'locked', event: Event): void {
    event.stopPropagation();
    this.focusedKey.set(`layer:${layer.id}`);
    this.bus.dispatch({
      type: 'layer.update',
      id: layer.id,
      [flag]: flag === 'visible' ? !layer.visible : !layer.locked,
    });
  }

  protected toggleObjectFlag(
    object: OutlinerObject,
    flag: 'visible' | 'locked',
    event: Event,
  ): void {
    event.stopPropagation();
    this.focusedKey.set(`object:${object.id}`);
    this.bus.dispatch({
      type: 'object.setFlags',
      ids: [object.id],
      [flag]: flag === 'visible' ? !object.visible : !object.locked,
    });
  }

  protected renameLayer(id: string, event: Event): void {
    event.stopPropagation();
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const name = input.value.trim();
    if (!name) {
      return;
    }
    this.bus.dispatch({ type: 'layer.update', id, name });
  }

  protected moveLayer(id: string, index: number, event: Event): void {
    event.stopPropagation();
    this.focusedKey.set(`layer:${id}`);
    this.bus.dispatch({ type: 'layer.reorder', id, index });
  }

  protected onLayerClick(id: string): void {
    this.toggleLayer(id);
  }

  protected onObjectClick(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.focusedKey.set(`object:${id}`);
    this.bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [id],
      op: event.shiftKey ? 'add' : 'replace',
    });
  }

  protected onTreeKeydown(event: KeyboardEvent): void {
    if (isTypingTarget(event.target)) {
      return;
    }
    const rows = this.focusableRows();
    if (rows.length === 0) {
      return;
    }
    const index = Math.max(
      0,
      rows.findIndex((row) => row.key === this.activeFocusKey()),
    );
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex =
        event.key === 'ArrowDown' ? Math.min(rows.length - 1, index + 1) : Math.max(0, index - 1);
      this.focusRow(rows[nextIndex]?.key);
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    const row = rows[index];
    if (!row) {
      return;
    }
    if (row.kind === 'layer') {
      this.toggleLayer(row.id);
      return;
    }
    this.bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [row.id],
      op: 'replace',
    });
  }

  private toggleLayer(id: string): void {
    this.focusedKey.set(`layer:${id}`);
    this.collapsedLayerIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  private focusRow(key: string | undefined): void {
    if (!key) {
      return;
    }
    this.focusedKey.set(key);
    queueMicrotask(() => {
      const element = this.host.nativeElement.querySelector(`[data-tree-key="${key}"]`);
      if (element instanceof HTMLElement) {
        element.focus();
      }
    });
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
