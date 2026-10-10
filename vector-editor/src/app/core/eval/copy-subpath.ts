import { Subpath, Vec2 } from '@vector-editor/modules/types/types';

export function replicaId(id: string, modifierId: string, replica: string): string {
  return `${id}/${modifierId}/${replica}`;
}

export function mapSubpath(
  subpath: Subpath,
  modifierId: string,
  replica: string,
  mapPoint: (point: Vec2) => Vec2,
): Subpath {
  const ids = new Map(
    subpath.anchors.map((anchor) => [anchor.id, replicaId(anchor.id, modifierId, replica)]),
  );
  return {
    closed: subpath.closed,
    anchors: subpath.anchors.map((anchor) => ({
      id: ids.get(anchor.id) ?? replicaId(anchor.id, modifierId, replica),
      position: mapPoint(anchor.position),
      handleIn: anchor.handleIn ? mapPoint(anchor.handleIn) : null,
      handleOut: anchor.handleOut ? mapPoint(anchor.handleOut) : null,
    })),
    segments: subpath.segments.map((segment) => ({
      id: replicaId(segment.id, modifierId, replica),
      kind: segment.kind,
      fromId: ids.get(segment.fromId) ?? segment.fromId,
      toId: ids.get(segment.toId) ?? segment.toId,
    })),
  };
}
