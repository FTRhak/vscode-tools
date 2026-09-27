import { Component, computed, inject } from '@angular/core';
import { SessionService } from '@vector-editor/core';
import { sceneFromDocument } from '../../../viewport/scene';

@Component({
  selector: 'app-preview-panel',
  templateUrl: './preview-panel.html',
  styleUrl: './preview-panel.scss',
})
export class PreviewPanel {
  private readonly session = inject(SessionService);

  protected readonly frame = computed(() => {
    const document = this.session.document();
    if (!document) {
      return null;
    }
    const scene = sceneFromDocument(document, this.session.clipperHold());
    if (scene.objects.length === 0) {
      return null;
    }
    const box = scene.viewBox;
    return {
      scene,
      viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
      ratio: `${box.width} / ${box.height}`,
    };
  });
}
