import { Component, computed, inject } from '@angular/core';
import { Anchor, SessionService } from '@vector-editor/core';
import { SharedModule } from '@vector-editor/shared';
import { AnchorOptions } from '../anchor-options/anchor-options';
import { ObjectOptions } from '../object-options/object-options';

@Component({
  selector: 'app-options-panel',
  imports: [AnchorOptions, ObjectOptions, SharedModule],
  templateUrl: './options-panel.html',
})
export class OptionsPanel {
  private readonly session = inject(SessionService);

  public readonly panelName = 'Options';

  private readonly selectedObjects = computed(() => {
    const document = this.session.document();
    if (!document) {
      return [];
    }
    const selected = new Set(this.session.selectedObjectIds());
    return document.objects.filter((object) => selected.has(object.id));
  });

  protected readonly showObjectOptions = computed(
    () => this.session.mode() === 'object' && this.selectedObjects().length > 0,
  );

  protected readonly showAnchorOptions = computed(() => this.anchorsOfActive(this.session).length > 0);


  private anchorsOfActive(session: SessionService): readonly Anchor[] {
    if (session.mode() !== 'edit') {
      return [];
    }
    const document = session.document();
    const activeId = session.activeObjectId();
    const object = document?.objects.find((item) => item.id === activeId);
    if (!object) {
      return [];
    }
    const selected = new Set(session.selectedAnchorIds());
    const anchors: Anchor[] = [];
    for (const subpath of object.source.subpaths) {
      for (const anchor of subpath.anchors) {
        if (selected.has(anchor.id)) {
          anchors.push(anchor);
        }
      }
    }
    return anchors;
  }
}
