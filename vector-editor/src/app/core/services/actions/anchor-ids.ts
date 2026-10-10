import { VectorObject } from '@vector-editor/modules/types';

export function anchorIds(object: VectorObject): Set<string> {
  const ids = new Set<string>();
  for (const subpath of object.source.subpaths) {
    for (const anchor of subpath.anchors) {
      ids.add(anchor.id);
    }
  }
  return ids;
}
