import { createId } from '../core/utils/create-id';
import { Anchor, Document, Modifier, SourcePath, Subpath, VectorObject } from './types';

export const DUPLICATE_OFFSET = 24;

export function duplicateObjects(
  document: Document,
  ids: readonly string[],
): { readonly document: Document; readonly newIds: readonly string[] } | null {
  const wanted = new Set(ids);
  const sources = document.objects.filter((object) => wanted.has(object.id));
  if (sources.length === 0) {
    return null;
  }

  const objectIds = new Map(sources.map((object) => [object.id, createId()]));
  const copies = sources.map((object) => cloneObject(object, objectIds));
  return {
    document: { ...document, objects: [...document.objects, ...copies] },
    newIds: copies.map((object) => object.id),
  };
}

function cloneObject(object: VectorObject, objectIds: ReadonlyMap<string, string>): VectorObject {
  const id = objectIds.get(object.id) ?? createId();
  return {
    ...object,
    id,
    name: `${object.name} copy`,
    source: cloneSource(object.source),
    transform: {
      ...object.transform,
      x: object.transform.x + DUPLICATE_OFFSET,
      y: object.transform.y + DUPLICATE_OFFSET,
    },
    modifiers: object.modifiers.map((modifier) => cloneModifier(modifier, objectIds)),
  };
}

function cloneSource(source: SourcePath): SourcePath {
  return { subpaths: source.subpaths.map(cloneSubpath) };
}

function cloneSubpath(subpath: Subpath): Subpath {
  const anchorIds = new Map(subpath.anchors.map((anchor) => [anchor.id, createId()]));
  return {
    closed: subpath.closed,
    anchors: subpath.anchors.map((anchor) => cloneAnchor(anchor, anchorIds)),
    segments: subpath.segments.map((segment) => ({
      id: createId(),
      kind: segment.kind,
      fromId: anchorIds.get(segment.fromId) ?? segment.fromId,
      toId: anchorIds.get(segment.toId) ?? segment.toId,
    })),
  };
}

function cloneAnchor(anchor: Anchor, anchorIds: ReadonlyMap<string, string>): Anchor {
  return {
    id: anchorIds.get(anchor.id) ?? createId(),
    position: { ...anchor.position },
    handleIn: anchor.handleIn ? { ...anchor.handleIn } : null,
    handleOut: anchor.handleOut ? { ...anchor.handleOut } : null,
  };
}

function cloneModifier(modifier: Modifier, objectIds: ReadonlyMap<string, string>): Modifier {
  const id = createId();
  if (modifier.type === 'boolean') {
    return {
      ...modifier,
      id,
      operandId: objectIds.get(modifier.operandId) ?? modifier.operandId,
    };
  }
  if (modifier.type === 'trace') {
    return {
      ...modifier,
      id,
      regions: modifier.regions.map((region) => ({
        fill: region.fill,
        source: cloneSource(region.source),
      })),
    };
  }
  return { ...modifier, id };
}
