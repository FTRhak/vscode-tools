import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { SNAP_MODES, SnapMode } from '../../utils/snap';

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
  protected readonly label = computed(() => SNAP_MODES.find((option) => option.id === this.mode())?.label ?? 'Off');
  protected readonly enabled = computed(() => this.mode() !== 'off');

  constructor() {
    fromEvent<KeyboardEvent>(this.document, 'keydown', { capture: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.key !== 'Escape' || !this.menuOpen()) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.menuOpen.set(false);
      });

    fromEvent(this.document, 'pointerdown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.menuOpen.set(false));
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
