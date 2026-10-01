import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkPortal, CdkPortalOutlet } from '@angular/cdk/portal';
import { Component, computed, inject, signal } from '@angular/core';
import { ColorSlot, CommandBus } from '@vector-editor/commands';
import {
  createId,
  Gradient,
  GradientStop,
  GradientType,
  nextSeriesName,
  SessionService,
} from '@vector-editor/core';
import { ColorTarget } from '../../services/color-target';
import { gradientBackground } from '../../../../viewport/utils/scene';

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
    stops: this.stops().map((stop, index, stops) => ({
      ...stop,
      offset: index / (stops.length - 1),
    })),
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
      stops: stops.map((stop, index) => ({
        ...stop,
        offset: index / (stops.length - 1),
      })),
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
