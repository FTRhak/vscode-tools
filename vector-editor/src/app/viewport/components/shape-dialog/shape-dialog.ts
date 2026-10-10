import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, hidden, max, min, required } from '@angular/forms/signals';
import { SHAPE_NAMES, ShapeKind } from '@vector-editor/modules/shapes';
import { Vec2 } from '@vector-editor/modules/types';

export interface ShapeDialogRequest {
  readonly kind: ShapeKind;
  readonly origin: Vec2;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly innerRadius: number;
  readonly count: number;
}

export interface ShapeDialogValues {
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly innerRadius: number;
  readonly count: number;
}

interface ShapeDraft {
  kind: ShapeKind;
  width: number | null;
  height: number | null;
  radius: number | null;
  innerRadius: number | null;
  count: number | null;
}

@Component({
  selector: 'app-shape-dialog',
  imports: [CdkTrapFocus, FormField],
  templateUrl: './shape-dialog.html',
  styleUrl: './shape-dialog.scss',
})
export class ShapeDialog {
  readonly request = input<ShapeDialogRequest | null>(null);
  readonly confirmed = output<ShapeDialogValues>();
  readonly dismissed = output<void>();

  protected readonly submitted = signal(false);
  protected readonly draft = signal<ShapeDraft>({
    kind: 'rectangle',
    width: 100,
    height: 100,
    radius: 50,
    innerRadius: 25,
    count: 5,
  });
  protected readonly shapeForm = form(this.draft, (path) => {
    hidden(path.width, { when: ({ valueOf }) => !isBoxKind(valueOf(path.kind)) });
    hidden(path.height, { when: ({ valueOf }) => !isBoxKind(valueOf(path.kind)) });
    hidden(path.radius, { when: ({ valueOf }) => !isRadialKind(valueOf(path.kind)) });
    hidden(path.innerRadius, { when: ({ valueOf }) => valueOf(path.kind) !== 'star' });
    hidden(path.count, { when: ({ valueOf }) => !isRadialKind(valueOf(path.kind)) });
    required(path.width, { message: 'Enter a width.' });
    min(path.width, 0.001, { message: 'Width must be greater than 0.' });
    required(path.height, { message: 'Enter a height.' });
    min(path.height, 0.001, { message: 'Height must be greater than 0.' });
    required(path.radius, { message: 'Enter a radius.' });
    min(path.radius, 0.001, { message: 'Radius must be greater than 0.' });
    required(path.innerRadius, { message: 'Enter an inner radius.' });
    min(path.innerRadius, 0, { message: 'Inner radius must be at least 0.' });
    max(
      path.innerRadius,
      ({ valueOf }) => {
        const radius = valueOf(path.radius);
        return radius === null ? undefined : radius;
      },
      { message: 'Inner radius must fit inside the outer radius.' },
    );
    required(path.count, { message: 'Enter a count.' });
    min(path.count, 3, { message: 'Enter at least 3.' });
    max(path.count, ({ valueOf }) => (valueOf(path.kind) === 'star' ? 32 : 64), {
      message: ({ valueOf }) => (valueOf(path.kind) === 'star' ? 'Enter at most 32 points.' : 'Enter at most 64 sides.'),
    });
  });
  protected readonly kind = computed(() => this.draft().kind);
  protected readonly title = computed(() => SHAPE_NAMES[this.kind()]);
  protected readonly box = computed(() => isBoxKind(this.kind()));
  protected readonly radial = computed(() => isRadialKind(this.kind()));

  constructor() {
    effect(() => {
      const request = this.request();
      if (!request) {
        return;
      }
      this.submitted.set(false);
      this.draft.set({
        kind: request.kind,
        width: request.width,
        height: request.height,
        radius: request.radius,
        innerRadius: request.innerRadius,
        count: request.count,
      });
    });
  }

  protected fieldError(field: 'width' | 'height' | 'radius' | 'innerRadius' | 'count'): string | null {
    if (!this.submitted()) {
      return null;
    }
    return this.shapeForm[field]().errors()[0]?.message ?? null;
  }

  protected confirm(): void {
    this.submitted.set(true);
    const { width, height, radius, innerRadius, count } = this.draft();
    if (this.shapeForm().invalid() || width === null || height === null || radius === null || innerRadius === null || count === null) {
      return;
    }
    this.confirmed.emit({ width, height, radius, innerRadius, count });
  }

  protected cancel(): void {
    this.dismissed.emit();
  }
}

function isBoxKind(kind: ShapeKind): boolean {
  return kind === 'rectangle' || kind === 'ellipse' || kind === 'rhombus';
}

function isRadialKind(kind: ShapeKind): boolean {
  return kind === 'star' || kind === 'polygon';
}
