import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { OutlinerLayer } from '../../models';

@Component({
  selector: 'app-outliner-layer-row',
  standalone: false,
  host: {
    class: 'tree-row layer-row',
    '[class.selected]': 'layer().selected',
    '(click)': 'onClick()',
  },
  templateUrl: './outliner-layer-row.html',
  styleUrl: './outliner-layer-row.scss',
})
export class OutlinerLayerRow {
  private readonly injector = inject(Injector);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  readonly layer = input.required<OutlinerLayer>();

  readonly selected = output<void>();
  readonly expandedToggled = output<Event>();
  readonly visibilityToggled = output<Event>();
  readonly lockToggled = output<Event>();
  readonly renamed = output<Event>();
  readonly movedForward = output<Event>();
  readonly movedBackward = output<Event>();

  protected readonly editing = signal(false);

  protected onClick(): void {
    this.selected.emit();
  }

  protected toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expandedToggled.emit(event);
  }

  protected toggleVisibility(event: Event): void {
    event.stopPropagation();
    this.visibilityToggled.emit(event);
  }

  protected toggleLock(event: Event): void {
    event.stopPropagation();
    this.lockToggled.emit(event);
  }

  protected startRename(event: Event): void {
    event.stopPropagation();
    this.editing.set(true);
    afterNextRender(
      () => {
        const input = this.nameInput()?.nativeElement;
        input?.focus();
        input?.select();
      },
      { injector: this.injector },
    );
  }

  protected finishRename(event: Event): void {
    if (!this.editing()) {
      return;
    }
    event.stopPropagation();
    this.editing.set(false);
    this.renamed.emit(event);
  }

  protected cancelRename(event: Event): void {
    event.stopPropagation();
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    this.editing.set(false);
  }

  protected moveForward(event: Event): void {
    event.stopPropagation();
    this.movedForward.emit(event);
  }

  protected moveBackward(event: Event): void {
    event.stopPropagation();
    this.movedBackward.emit(event);
  }
}
