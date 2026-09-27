import { createId } from '../model/create-id';
import { SourcePath } from '../model/types';

export function remintSource(source: SourcePath): SourcePath {
  return {
    subpaths: source.subpaths.map((subpath) => {
      const ids = new Map(subpath.anchors.map((anchor) => [anchor.id, createId()]));
      return {
        closed: subpath.closed,
        anchors: subpath.anchors.map((anchor) => ({
          id: ids.get(anchor.id) ?? createId(),
          position: { ...anchor.position },
          handleIn: anchor.handleIn ? { ...anchor.handleIn } : null,
          handleOut: anchor.handleOut ? { ...anchor.handleOut } : null,
        })),
        segments: subpath.segments.map((segment) => ({
          id: createId(),
          kind: segment.kind,
          fromId: ids.get(segment.fromId) ?? segment.fromId,
          toId: ids.get(segment.toId) ?? segment.toId,
        })),
      };
    }),
  };
}
