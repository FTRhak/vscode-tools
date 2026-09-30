import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, model, signal } from '@angular/core';
import { SNAP_MODES, SnapMode } from '../snap';

@Component({
  selector: 'app-snap-bar',
  host: {
    class: 'snap-bar',
    'data-snap-bar': '',
    role: 'toolbar',
    'aria-label': 'Snapping',
    '(pointerdown)': 'onPointerDown($event)',
  },
  templateUrl: './snap-bar.html',
  styleUrl: './snap-bar.scss',
})
export class SnapBar {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = model<SnapMode>('off');

  protected readonly modes = SNAP_MODES;
  protected readonly menuOpen = signal(false);
  private readonly remembered = signal<SnapMode>('grid_100');
  protected readonly label = computed(
    () => SNAP_MODES.find((option) => option.id === this.mode())?.label ?? 'Off',
  );
  protected readonly enabled = computed(() => this.mode() !== 'off');

  constructor() {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.menuOpen()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.menuOpen.set(false);
    };
    const onPointerDown = () => {
      this.menuOpen.set(false);
    };
    this.document.addEventListener('keydown', onKeyDown, true);
    this.document.addEventListener('pointerdown', onPointerDown);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('keydown', onKeyDown, true);
      this.document.removeEventListener('pointerdown', onPointerDown);
    });
  }

  protected toggle(): void {
    this.menuOpen.set(false);
    if (this.mode() === 'off') {
      const next = this.remembered();
      this.mode.set(next === 'off' ? 'grid_100' : next);
      return;
    }
    this.remembered.set(this.mode());
    this.mode.set('off');
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected choose(mode: SnapMode): void {
    if (mode !== 'off') {
      this.remembered.set(mode);
    }
    this.mode.set(mode);
    this.menuOpen.set(false);
  }

  protected onPointerDown(event: PointerEvent): void {
    event.stopPropagation();
  }
}
