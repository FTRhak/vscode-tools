import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import {
  deletableObjectIds,
  isEmptyPoint,
  layersFrontToBack,
  objectsOnLayer,
  SessionService,
} from '@vector-editor/core';
import { OutlinerLayer, OutlinerObject, TreeRow } from '../../models';

@Component({
  selector: 'app-outliner-panel',
  standalone: false,
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
    const editing = this.session.mode() === 'edit';
    const selected = new Set(this.session.selectedObjectIds());
    const selectedLayerId = this.session.selectedLayerId();
    const activeId = this.session.activeObjectId();
    const layers = layersFrontToBack(document).map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      expanded: !collapsed.has(layer.id),
      selected: layer.id === selectedLayerId,
      objects: objectsOnLayer(document, layer.id)
        .filter((object) => !(editing && isEmptyPoint(object)))
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

  protected readonly canDelete = computed(() => {
    const document = this.session.document();
    if (!document) {
      return false;
    }
    return deletableObjectIds(document, this.session.selectedObjectIds()).length > 0;
  });

  protected readonly canDeleteLayer = computed(() => {
    const document = this.session.document();
    const layerId = this.session.selectedLayerId();
    if (!document || !layerId) {
      return false;
    }
    const layer = document.layers.find((item) => item.id === layerId);
    return layer !== undefined && !layer.locked;
  });

  protected readonly canAddPath = computed(() => {
    const document = this.session.document();
    const layerId = this.session.selectedLayerId();
    if (!document || !layerId) {
      return false;
    }
    const layer = document.layers.find((item) => item.id === layerId);
    return layer !== undefined && layer.visible && !layer.locked;
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

  protected deleteSelected(): void {
    const document = this.session.document();
    if (!document) {
      return;
    }
    const ids = deletableObjectIds(document, this.session.selectedObjectIds());
    if (ids.length === 0) {
      return;
    }
    this.bus.dispatch({ type: 'object.delete', ids });
  }

  protected deleteSelectedLayer(): void {
    const layerId = this.session.selectedLayerId();
    if (!layerId || !this.canDeleteLayer()) {
      return;
    }
    this.bus.dispatch({ type: 'layer.delete', id: layerId });
  }

  protected addPath(): void {
    const layerId = this.session.selectedLayerId();
    if (!layerId || !this.canAddPath()) {
      return;
    }
    this.expandLayer(layerId);
    this.bus.dispatch({ type: 'path.add', layerId });
    const objectId = this.session.activeObjectId();
    if (objectId) {
      this.focusedKey.set(`object:${objectId}`);
    }
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
    this.focusedKey.set(`layer:${id}`);
    this.bus.dispatch({ type: 'session.selectLayer', id });
  }

  protected onTwistClick(id: string, event: Event): void {
    event.stopPropagation();
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
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.onHorizontalArrow(rows, index, event.key);
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
      this.bus.dispatch({ type: 'session.selectLayer', id: row.id });
      return;
    }
    this.bus.dispatch({
      type: 'session.select',
      target: 'object',
      ids: [row.id],
      op: 'replace',
    });
  }

  private onHorizontalArrow(rows: readonly TreeRow[], index: number, key: string): void {
    const row = rows[index];
    if (!row) {
      return;
    }
    if (row.kind === 'object') {
      if (key === 'ArrowLeft') {
        const parent = this.layers().find((layer) =>
          layer.objects.some((object) => object.id === row.id),
        );
        this.focusRow(parent ? `layer:${parent.id}` : undefined);
      }
      return;
    }
    const expanded = this.layers().some((layer) => layer.id === row.id && layer.expanded);
    if (key === 'ArrowRight') {
      if (!expanded) {
        this.toggleLayer(row.id);
        return;
      }
      const child = rows[index + 1];
      if (child?.kind === 'object') {
        this.focusRow(child.key);
      }
      return;
    }
    if (expanded) {
      this.toggleLayer(row.id);
    }
  }

  private expandLayer(id: string): void {
    this.collapsedLayerIds.update((current) => {
      if (!current.has(id)) {
        return current;
      }
      const next = new Set(current);
      next.delete(id);
      return next;
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
