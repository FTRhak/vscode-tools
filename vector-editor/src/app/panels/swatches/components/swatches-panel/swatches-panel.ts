import { Component, computed, inject } from '@angular/core';
import { CommandBus } from '@vector-editor/commands';
import { SessionService } from '@vector-editor/core';
import { SharedModule } from '@vector-editor/shared';
import { ColorTarget } from '../../../color/services/color-target';
import { gradientBackground } from '../../../../viewport/utils/scene';
import { VectorObject } from '@vector-editor/modules/types';
import { nextSeriesName } from '@vector-editor/modules/document-edits';

@Component({
  imports: [SharedModule],
  selector: 'app-swatches-panel',
  templateUrl: './swatches-panel.html',
  styleUrl: './swatches-panel.scss',
})
export class SwatchesPanel {
  private readonly session = inject(SessionService);
  private readonly bus = inject(CommandBus);
  private readonly colorTarget = inject(ColorTarget);

  public readonly panelName = 'Color Collections';

  protected readonly swatches = computed(() => this.session.document()?.swatches ?? []);
  private readonly gradients = computed(() => this.session.document()?.gradients ?? []);

  private readonly selectedObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const selected = new Set(this.session.selectedObjectIds());
    return document.objects.filter((object) => selected.has(object.id));
  });

  protected readonly sharedFill = computed(() => sharedFill(this.selectedObjects()));

  protected swatchBackground(color: string): string {
    const gradientId = /^url\(#(.+)\)$/.exec(color)?.[1];
    const gradient = this.gradients().find((item) => item.id === gradientId);
    return gradient ? gradientBackground(gradient) : color;
  }

  protected apply(swatchId: string): void {
    const ids = this.selectedObjects().map((object) => object.id);
    if (ids.length === 0) {
      return;
    }
    this.bus.dispatch({
      type: 'swatch.apply',
      swatchId,
      target: this.colorTarget.slot(),
      objectIds: ids,
    });
  }

  protected add(): void {
    const fill = this.sharedFill();
    const document = this.session.document();
    if (!fill || !document) {
      return;
    }
    this.bus.dispatch({
      type: 'swatch.add',
      name: nextSeriesName(
        document.swatches.map((swatch) => swatch.name),
        'Swatch',
      ),
      color: fill,
    });
  }
}

function sharedFill(objects: readonly VectorObject[]): string | null {
  const fill = objects[0]?.style.fill;
  if (!fill || objects.some((object) => object.style.fill !== fill)) {
    return null;
  }
  return fill;
}
