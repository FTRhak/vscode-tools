import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import { Modifier, VectorObject } from '@vector-editor/core';

import { ArrayModifierFields } from '../array-modifier-fields/array-modifier-fields';
import { BevelModifierFields } from '../bevel-modifier-fields/bevel-modifier-fields';
import { BooleanModifierFields } from '../boolean-modifier-fields/boolean-modifier-fields';
import { MirrorModifierFields } from '../mirror-modifier-fields/mirror-modifier-fields';

type BooleanOperation = 'union' | 'difference' | 'intersect';

@Component({
  selector: 'app-modifier-row',
  imports: [
    ArrayModifierFields,
    BevelModifierFields,
    BooleanModifierFields,
    CdkDragHandle,
    MirrorModifierFields,
  ],
  templateUrl: './modifier-row.html',
  styleUrl: './modifier-row.scss',
})
export class ModifierRow {
  private readonly bus = inject(CommandBus);

  readonly modifier = input.required<Modifier>();
  readonly objectId = input.required<string>();
  readonly objects = input.required<readonly VectorObject[]>();

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

  protected toggleEnabled(): void {
    this.patch({ enabled: !this.modifier().enabled });
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

  protected patch(patch: {
    readonly enabled?: boolean;
    readonly count?: number;
    readonly offsetX?: number;
    readonly offsetY?: number;
    readonly axis?: 'x' | 'y' | 'xy';
    readonly distance?: number;
    readonly join?: 'bevel' | 'miter' | 'round';
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
