import { Document, Vec2, VectorObject } from '@vector-editor/modules/types';
import { localToDocument } from './hit-test';

export type SnapMode = 'off' | 'grid_100' | 'grid_010' | 'grid_001' | 'object' | 'layer';

export interface SnapModeOption {
  readonly id: SnapMode;
  readonly label: string;
  readonly hint: string;
}

export const SNAP_MODES: readonly SnapModeOption[] = [
  { id: 'off', label: 'Off', hint: 'Free' },
  { id: 'grid_100', label: 'Grid 1', hint: '1' },
  { id: 'grid_010', label: 'Grid 0.1', hint: '0.1' },
  { id: 'grid_001', label: 'Grid 0.01', hint: '0.01' },
  { id: 'object', label: 'Object', hint: 'Same layer' },
  { id: 'layer', label: 'Layer', hint: 'All layers' },
];

export const SNAP_THRESHOLD_PX = 8;

export interface SnapSource {
  readonly start: Vec2;
}

export function gridStep(mode: SnapMode): number | null {
  switch (mode) {
    case 'grid_100':
      return 1;
    case 'grid_010':
      return 0.1;
    case 'grid_001':
      return 0.01;
    default:
      return null;
  }
}

export function snapToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || !(step > 0)) {
    return value;
  }
  const places = step >= 1 ? 0 : Math.max(0, Math.round(-Math.log10(step)));
  const snapped = Math.round(value / step) * step;
  const factor = 10 ** places;
  return Math.round(snapped * factor) / factor;
}

export function snapToGrid(point: Vec2, step: number): Vec2 {
  return { x: snapToStep(point.x, step), y: snapToStep(point.y, step) };
}

export function snapToPoints(point: Vec2, targets: readonly Vec2[], threshold: number): Vec2 {
  let best: Vec2 | null = null;
  let bestDistance = threshold;
  for (const target of targets) {
    const distance = Math.hypot(target.x - point.x, target.y - point.y);
    if (distance <= bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best ?? point;
}

export function snapTranslation(
  rawDelta: Vec2,
  sources: readonly SnapSource[],
  mode: SnapMode,
  targets: readonly Vec2[],
  threshold: number,
): Vec2 {
  if (mode === 'off' || sources.length === 0) {
    return rawDelta;
  }
  const step = gridStep(mode);
  if (step !== null) {
    const source = sources[0];
    const snapped = snapToGrid({ x: source.start.x + rawDelta.x, y: source.start.y + rawDelta.y }, step);
    return { x: snapped.x - source.start.x, y: snapped.y - source.start.y };
  }
  if (mode !== 'object' && mode !== 'layer') {
    return rawDelta;
  }
  let bestDelta = rawDelta;
  let bestDistance = threshold;
  let found = false;
  for (const source of sources) {
    const raw = { x: source.start.x + rawDelta.x, y: source.start.y + rawDelta.y };
    for (const target of targets) {
      const distance = Math.hypot(target.x - raw.x, target.y - raw.y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        found = true;
        bestDelta = { x: target.x - source.start.x, y: target.y - source.start.y };
      }
    }
  }
  return found ? bestDelta : rawDelta;
}

export function collectSnapTargets(
  document: Document,
  mode: 'object' | 'layer',
  excludeIds: ReadonlySet<string>,
  layerId: string | null,
): readonly Vec2[] {
  const points: Vec2[] = [];
  for (const object of document.objects) {
    if (!object.visible || excludeIds.has(object.id)) {
      continue;
    }
    const layer = document.layers.find((item) => item.id === object.layerId);
    if (layer && !layer.visible) {
      continue;
    }
    if (mode === 'object' && object.layerId !== layerId) {
      continue;
    }
    points.push({ x: object.transform.x, y: object.transform.y });
    for (const subpath of object.source.subpaths) {
      for (const anchor of subpath.anchors) {
        points.push(localToDocument(object.transform, anchor.position));
      }
    }
  }
  return points;
}

export function objectSnapSources(objects: readonly VectorObject[], primaryId: string | null): readonly SnapSource[] {
  const primary = objects.find((object) => object.id === primaryId) ?? objects[0];
  const ordered = primary ? [primary, ...objects.filter((object) => object !== primary)] : [];
  const sources: SnapSource[] = [];
  for (const object of ordered) {
    sources.push({ start: { x: object.transform.x, y: object.transform.y } });
    for (const subpath of object.source.subpaths) {
      for (const anchor of subpath.anchors) {
        sources.push({ start: localToDocument(object.transform, anchor.position) });
      }
    }
  }
  return sources;
}

export function anchorSnapSources(object: VectorObject, anchorIds: readonly string[], primaryId: string): readonly SnapSource[] {
  const wanted = new Set(anchorIds);
  wanted.add(primaryId);
  const byId = new Map<string, Vec2>();
  for (const subpath of object.source.subpaths) {
    for (const anchor of subpath.anchors) {
      if (wanted.has(anchor.id)) {
        byId.set(anchor.id, localToDocument(object.transform, anchor.position));
      }
    }
  }
  const sources: SnapSource[] = [];
  const primary = byId.get(primaryId);
  if (primary) {
    sources.push({ start: primary });
  }
  for (const [id, start] of byId) {
    if (id !== primaryId) {
      sources.push({ start });
    }
  }
  return sources;
}

export function anchorById(object: VectorObject, anchorId: string): Vec2 | null {
  for (const subpath of object.source.subpaths) {
    const anchor = subpath.anchors.find((item) => item.id === anchorId);
    if (anchor) {
      return anchor.position;
    }
  }
  return null;
}
