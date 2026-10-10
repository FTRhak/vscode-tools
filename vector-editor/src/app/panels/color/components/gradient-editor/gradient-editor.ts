import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkPortal, CdkPortalOutlet } from '@angular/cdk/portal';
import { Component, computed, inject, signal } from '@angular/core';
import { ColorSlot, CommandBus } from '@vector-editor/commands';
import {
  Gradient,
  GradientStop,
  GradientType,
} from '@vector-editor/modules/types';
import { ColorTarget } from '../../services/color-target';
import { gradientBackground } from '../../../../viewport/utils/scene';
import { SessionService } from '@vector-editor/core';
import { createId } from '@vector-editor/core/utils';
import { nextSeriesName } from '@vector-editor/modules/document-edits';

@Component({
  selector: 'app-gradient-editor',
  imports: [CdkPortal, CdkPortalOutlet, CdkTrapFocus],
  templateUrl: './gradient-editor.html',
  styleUrl: './gradient-editor.scss',
})
export class GradientEditor {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);
  protected readonly colorTarget = inject(ColorTarget);

  protected readonly open = signal(false);
  protected readonly hasDocument = computed(() => this.session.document() !== null);
  protected readonly gradients = computed(() => this.session.document()?.gradients ?? []);
  protected readonly selectedObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const selected = new Set(this.session.selectedObjectIds());
    return document.objects.filter((object) => selected.has(object.id));
  });
  protected readonly selectedGradientId = signal<string | null>(null);
  protected readonly name = signal('Gradient');
  protected readonly type = signal<GradientType>('linear');
  protected readonly angle = signal(0);
  protected readonly proportions = signal(1);
  protected readonly draggingStopId = signal<string | null>(null);
  protected readonly stops = signal<readonly GradientStop[]>([
    { id: createId(), offset: 0, color: '#f0523a', opacity: 1 },
    { id: createId(), offset: 1, color: '#3974d5', opacity: 1 },
  ]);
  protected readonly draftGradient = computed<Gradient>(() => ({
    id: 'draft',
    name: this.name(),
    type: this.type(),
    angle: this.angle(),
    proportions: this.proportions(),
    stops: [...this.stops()].sort((left, right) => left.offset - right.offset),
  }));

  private resetDraft(): void {
    this.name.set('Gradient');
    this.type.set('linear');
    this.angle.set(0);
    this.proportions.set(1);
    this.stops.set([
      { id: createId(), offset: 0, color: '#f0523a', opacity: 1 },
      { id: createId(), offset: 1, color: '#3974d5', opacity: 1 },
    ]);
  }

  protected openEditor(): void {
    this.open.set(true);
  }

  protected closeEditor(): void {
    this.open.set(false);
    this.selectedGradientId.set(null);
    this.resetDraft();
  }

  protected startNewGradient(): void {
    this.selectedGradientId.set(null);
    this.resetDraft();
  }

  protected selectGradient(id: string): void {
    const gradient = this.gradients().find((item) => item.id === id);
    if (!gradient) {
      return;
    }
    this.selectedGradientId.set(id);
    this.name.set(gradient.name);
    this.type.set(gradient.type);
    this.angle.set(gradient.angle);
    this.proportions.set(gradient.proportions);
    this.stops.set(
      gradient.stops.map((stop) => ({
        ...stop,
        id: stop.id || createId(),
      })),
    );
  }

  protected stopBackdrop(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeEditor();
    }
  }

  protected chooseSlot(slot: ColorSlot): void {
    this.colorTarget.setSlot(slot);
  }

  protected chooseType(type: GradientType): void {
    this.type.set(type);
  }

  protected updateName(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.name.set(input.value);
    }
  }

  protected updateAngle(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.angle.set(value);
    }
  }

  protected updateProportions(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value > 0) {
      this.proportions.set(value);
    }
  }

  protected opacityPercent(value: number): number {
    return Math.round(value * 100);
  }

  protected updateStopColor(event: Event, id: string): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.stops.update((stops) =>
        stops.map((stop) => (stop.id === id ? { ...stop, color: input.value } : stop)),
      );
    }
  }

  protected updateStopOpacity(event: Event, id: string): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      const opacity = Number(input.value) / 100;
      this.stops.update((stops) =>
        stops.map((stop) => (stop.id === id ? { ...stop, opacity } : stop)),
      );
    }
  }

  protected updateStopPosition(event: Event, id: string): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      const offset = Number(input.value) / 100;
      if (Number.isFinite(offset) && offset >= 0 && offset <= 1) {
        this.setStopOffset(id, offset);
      }
    }
  }

  protected beginStopDrag(event: PointerEvent, id: string, preview: HTMLDivElement): void {
    event.preventDefault();
    this.draggingStopId.set(id);
    (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
    this.setStopOffsetFromPointer(event, preview, id);
  }

  protected moveStopWithPointer(event: PointerEvent, preview: HTMLDivElement): void {
    const id = this.draggingStopId();
    if (id) {
      this.setStopOffsetFromPointer(event, preview, id);
    }
  }

  protected endStopDrag(): void {
    this.draggingStopId.set(null);
  }

  protected handleStopPositionKey(event: KeyboardEvent, id: string): void {
    const stop = this.stops().find((item) => item.id === id);
    if (!stop) {
      return;
    }

    const step = event.shiftKey ? 0.1 : 0.01;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setStopOffset(id, stop.offset - step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.setStopOffset(id, stop.offset + step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.setStopOffset(id, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.setStopOffset(id, 1);
    }
  }

  private setStopOffsetFromPointer(event: PointerEvent, preview: HTMLDivElement, id: string): void {
    const bounds = preview.getBoundingClientRect();
    this.setStopOffset(id, (event.clientX - bounds.left) / bounds.width);
  }

  private setStopOffset(id: string, offset: number): void {
    const boundedOffset = Math.min(1, Math.max(0, offset));
    this.stops.update((stops) =>
      stops.map((stop) => (stop.id === id ? { ...stop, offset: boundedOffset } : stop)),
    );
  }

  protected addStop(): void {
    this.stops.update((stops) => [
      ...stops,
      { id: createId(), offset: 1, color: '#ffffff', opacity: 1 },
    ]);
  }

  protected removeStop(id: string): void {
    this.stops.update((stops) =>
      stops.length > 2 ? stops.filter((stop) => stop.id !== id) : stops,
    );
  }

  protected gradientBackground = gradientBackground;

  protected applyGradient(id: string): void {
    const objects = this.selectedObjects();
    if (objects.length === 0 || !this.gradients().some((gradient) => gradient.id === id)) {
      return;
    }
    this.bus.dispatch({
      type: 'style.set',
      objectIds: objects.map((object) => object.id),
      [this.colorTarget.slot()]: `url(#${id})`,
    });
    this.closeEditor();
  }

  protected deleteGradient(id: string): void {
    this.bus.dispatch({ type: 'gradient.delete', id });
    if (this.selectedGradientId() === id) {
      this.selectedGradientId.set(null);
      this.resetDraft();
    }
  }

  protected saveGradient(): void {
    const stops = this.stops();
    const payload = {
      name: this.name().trim() || 'Gradient',
      type: this.type(),
      angle: this.angle(),
      proportions: this.proportions(),
      stops: [...stops].sort((left, right) => left.offset - right.offset),
    };

    const activeId = this.selectedGradientId();
    if (activeId) {
      this.bus.dispatch({
        type: 'gradient.update',
        id: activeId,
        gradient: payload,
      });
      this.closeEditor();
      return;
    }

    const objects = this.selectedObjects();
    if (objects.length === 0 || stops.length < 2) {
      return;
    }
    this.bus.dispatch({
      type: 'gradient.create',
      gradient: {
        ...payload,
        name: nextSeriesName(
          this.gradients().map((gradient) => gradient.name),
          payload.name,
        ),
      },
      target: this.colorTarget.slot(),
      objectIds: objects.map((object) => object.id),
    });
    this.closeEditor();
  }
}
