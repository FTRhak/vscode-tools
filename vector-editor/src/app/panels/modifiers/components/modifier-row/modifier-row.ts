import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CommandBus } from '@vector-editor/commands/command-bus.service';
import { Modifier, VectorObject } from '@vector-editor/core';

interface ModifierDraft {
  readonly count: number | null;
  readonly offsetX: number | null;
  readonly offsetY: number | null;
  readonly distance: number | null;
  readonly miterLimit: number | null;
}

type OffsetKey = 'offsetX' | 'offsetY';
type BevelJoin = 'bevel' | 'miter' | 'round';
type BooleanOperation = 'union' | 'difference' | 'intersect';

@Component({
  selector: 'app-modifier-row',
  imports: [CdkDragHandle, FormField],
  templateUrl: './modifier-row.html',
  styleUrl: './modifier-row.scss',
})
export class ModifierRow {
  private readonly bus = inject(CommandBus);

  readonly modifier = input.required<Modifier>();
  readonly objectId = input.required<string>();
  readonly objects = input.required<readonly VectorObject[]>();

  private readonly draftSource = computed(() => draftFrom(this.modifier()), { equal: sameDraft });

  protected readonly draft = linkedSignal(() => this.draftSource());
  protected readonly modifierForm = form(this.draft);

  protected readonly title = computed(() => {
    switch (this.modifier().type) {
      case 'array':
        return 'Array';
      case 'mirror':
        return 'Mirror';
      case 'bevel':
        return 'Bevel';
      case 'boolean':
        return 'Boolean';
    }
  });

  protected readonly arrayModifier = computed(() => {
    const modifier = this.modifier();
    return modifier.type === 'array' ? modifier : null;
  });

  protected readonly mirrorModifier = computed(() => {
    const modifier = this.modifier();
    return modifier.type === 'mirror' ? modifier : null;
  });

  protected readonly bevelModifier = computed(() => {
    const modifier = this.modifier();
    return modifier.type === 'bevel' ? modifier : null;
  });

  protected readonly booleanModifier = computed(() => {
    const modifier = this.modifier();
    return modifier.type === 'boolean' ? modifier : null;
  });

  protected readonly peers = computed(() =>
    this.objects().filter((object) => object.id !== this.objectId()),
  );

  protected commitEnabled(event: Event): void {
    const inputElement = event.target;
    if (!(inputElement instanceof HTMLInputElement)) {
      return;
    }
    this.patch({ enabled: inputElement.checked });
  }

  protected commitCount(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const modifier = this.arrayModifier();
    const value = this.draft().count;
    if (!modifier || typeof value !== 'number' || !Number.isFinite(value)) {
      return;
    }
    const count = Math.max(1, Math.floor(value));
    if (count === modifier.count) {
      return;
    }
    this.patch({ count });
  }

  protected commitOffset(key: OffsetKey, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const modifier = this.arrayModifier();
    const value = this.draft()[key];
    if (
      !modifier ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value === modifier[key]
    ) {
      return;
    }
    this.patch({ [key]: value });
  }

  protected commitAxis(axis: 'x' | 'y' | 'xy'): void {
    const modifier = this.mirrorModifier();
    if (!modifier || modifier.axis === axis) {
      return;
    }
    this.patch({ axis });
  }

  protected commitDistance(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const modifier = this.bevelModifier();
    const value = this.draft().distance;
    if (
      !modifier ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value === modifier.distance
    ) {
      return;
    }
    this.patch({ distance: value });
  }

  protected commitMiterLimit(event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const modifier = this.bevelModifier();
    const value = this.draft().miterLimit;
    if (
      !modifier ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value === modifier.miterLimit
    ) {
      return;
    }
    this.patch({ miterLimit: value });
  }

  protected commitJoin(join: BevelJoin): void {
    const modifier = this.bevelModifier();
    if (!modifier || modifier.join === join) {
      return;
    }
    this.patch({ join });
  }

  protected commitOperation(operation: BooleanOperation): void {
    const modifier = this.booleanModifier();
    if (!modifier || modifier.operation === operation) {
      return;
    }
    this.patch({ operation });
  }

  protected commitOperand(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const modifier = this.booleanModifier();
    if (!modifier || modifier.operandId === select.value) {
      return;
    }
    this.patch({ operandId: select.value });
  }

  protected apply(): void {
    this.bus.dispatch({
      type: 'modifier.apply',
      objectId: this.objectId(),
      modifierId: this.modifier().id,
    });
  }

  protected remove(): void {
    this.bus.dispatch({
      type: 'modifier.remove',
      objectId: this.objectId(),
      modifierId: this.modifier().id,
    });
  }

  private patch(patch: {
    readonly enabled?: boolean;
    readonly count?: number;
    readonly offsetX?: number;
    readonly offsetY?: number;
    readonly axis?: 'x' | 'y' | 'xy';
    readonly distance?: number;
    readonly join?: BevelJoin;
    readonly miterLimit?: number;
    readonly operation?: BooleanOperation;
    readonly operandId?: string;
  }): void {
    this.bus.dispatch({
      type: 'modifier.update',
      objectId: this.objectId(),
      modifierId: this.modifier().id,
      patch,
    });
  }
}

function draftFrom(modifier: Modifier): ModifierDraft {
  if (modifier.type === 'array') {
    return {
      count: modifier.count,
      offsetX: modifier.offsetX,
      offsetY: modifier.offsetY,
      distance: null,
      miterLimit: null,
    };
  }
  if (modifier.type === 'bevel') {
    return {
      count: null,
      offsetX: null,
      offsetY: null,
      distance: modifier.distance,
      miterLimit: modifier.miterLimit,
    };
  }
  return { count: null, offsetX: null, offsetY: null, distance: null, miterLimit: null };
}

function sameDraft(left: ModifierDraft, right: ModifierDraft): boolean {
  return (
    left.count === right.count &&
    left.offsetX === right.offsetX &&
    left.offsetY === right.offsetY &&
    left.distance === right.distance &&
    left.miterLimit === right.miterLimit
  );
}
