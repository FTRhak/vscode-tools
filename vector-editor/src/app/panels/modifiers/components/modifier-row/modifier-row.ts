import { Component, computed, inject, input } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import { isEmptyPoint } from '@vector-editor/modules/object-empty-point';
import { isImage } from '@vector-editor/modules/object-image';
import { TraceSettings } from '@vector-editor/modules/image-trace';
import { ModifierPatch } from '@vector-editor/modules/modifier-edits';
import { Modifier, VectorObject } from '@vector-editor/modules/types';
import { traceImageContent } from '@vector-editor/viewport';
import { TraceModifierPatch } from '../trace-modifier-fields/trace-modifier-fields';

@Component({
  selector: 'app-modifier-row',
  standalone: false,
  templateUrl: './modifier-row.html',
  styleUrl: './modifier-row.scss',
})
export class ModifierRow {
  private readonly bus = inject(CommandBus);
  private traceSerial = 0;

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
      case 'round':
        return 'Round';
      case 'boolean':
        return 'Boolean';
      case 'trace':
        return 'Image to vector';
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

  protected readonly roundModifier = computed(() => {
    const modifier = this.modifier();
    return modifier.type === 'round' ? modifier : null;
  });

  protected readonly booleanModifier = computed(() => {
    const modifier = this.modifier();
    return modifier.type === 'boolean' ? modifier : null;
  });

  protected readonly traceModifier = computed(() => {
    const modifier = this.modifier();
    return modifier.type === 'trace' ? modifier : null;
  });

  protected readonly peers = computed(() =>
    this.objects().filter(
      (object) => object.id !== this.objectId() && !isEmptyPoint(object) && !isImage(object),
    ),
  );

  protected readonly emptyPoints = computed(() => this.objects().filter(isEmptyPoint));

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

  protected async commitTrace(patch: TraceModifierPatch): Promise<void> {
    const modifier = this.traceModifier();
    const object = this.objects().find((item) => item.id === this.objectId());
    if (!modifier || !object?.image) {
      return;
    }
    const retrace =
      patch.traceMode !== undefined ||
      patch.colors !== undefined ||
      patch.threshold !== undefined ||
      patch.paths !== undefined ||
      patch.corners !== undefined ||
      patch.noise !== undefined ||
      patch.optimization !== undefined ||
      patch.ignoreWhite !== undefined;
    if (!retrace) {
      this.patch(patch);
      return;
    }
    const serial = ++this.traceSerial;
    const settings: TraceSettings = {
      mode: patch.traceMode ?? modifier.mode,
      colors: patch.colors ?? modifier.colors,
      threshold: patch.threshold ?? modifier.threshold,
      paths: patch.paths ?? modifier.paths,
      corners: patch.corners ?? modifier.corners,
      noise: patch.noise ?? modifier.noise,
      optimization: patch.optimization ?? modifier.optimization,
      ignoreWhite: patch.ignoreWhite ?? modifier.ignoreWhite,
    };
    const traced = await traceImageContent(object.image, settings);
    if (serial !== this.traceSerial) {
      return;
    }
    this.patch({
      ...patch,
      regions: traced.regions,
      fault: traced.fault ?? null,
    });
  }

  protected patch(patch: ModifierPatch): void {
    this.bus.dispatch({
      type: 'modifier.update',
      objectId: this.objectId(),
      modifierId: this.modifier().id,
      patch,
    });
  }
}
