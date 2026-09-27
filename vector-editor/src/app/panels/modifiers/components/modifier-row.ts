import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Modifier } from '@vector-editor/core';
import { CommandBus } from '../../../commands/command-bus.service';

interface ArrayDraft {
  readonly count: number | null;
  readonly offsetX: number | null;
  readonly offsetY: number | null;
}

type OffsetKey = 'offsetX' | 'offsetY';

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
  }): void {
    this.bus.dispatch({
      type: 'modifier.update',
      objectId: this.objectId(),
      modifierId: this.modifier().id,
      patch,
    });
  }
}

function draftFrom(modifier: Modifier): ArrayDraft {
  if (modifier.type !== 'array') {
    return { count: null, offsetX: null, offsetY: null };
  }
  return {
    count: modifier.count,
    offsetX: modifier.offsetX,
    offsetY: modifier.offsetY,
  };
}

function sameDraft(left: ArrayDraft, right: ArrayDraft): boolean {
  return (
    left.count === right.count && left.offsetX === right.offsetX && left.offsetY === right.offsetY
  );
}
