import { createId } from './create-id';
import { evaluateSource } from '../eval/evaluate';
import { remintSource } from '../eval/remint';
import { Modifier, VectorObject } from './types';

export interface ModifierPatch {
  readonly enabled?: boolean;
  readonly count?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly axis?: 'x' | 'y' | 'xy';
}

export function addModifier(object: VectorObject, kind: 'array' | 'mirror'): VectorObject {
  const modifier = kind === 'array' ? defaultArray() : defaultMirror();
  return { ...object, modifiers: [...object.modifiers, modifier] };
}

export function updateModifier(
  object: VectorObject,
  modifierId: string,
  patch: ModifierPatch,
): VectorObject {
  let changed = false;
  const modifiers = object.modifiers.map((modifier) => {
    if (modifier.id !== modifierId) {
      return modifier;
    }
    const next = patchModifier(modifier, patch);
    if (next !== modifier) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...object, modifiers } : object;
}

export function removeModifier(object: VectorObject, modifierId: string): VectorObject {
  const modifiers = object.modifiers.filter((modifier) => modifier.id !== modifierId);
  return modifiers.length === object.modifiers.length ? object : { ...object, modifiers };
}

export function reorderModifier(
  object: VectorObject,
  modifierId: string,
  index: number,
): VectorObject {
  const from = object.modifiers.findIndex((modifier) => modifier.id === modifierId);
  if (from < 0 || !Number.isInteger(index)) {
    return object;
  }
  const to = Math.max(0, Math.min(index, object.modifiers.length - 1));
  if (from === to) {
    return object;
  }
  const modifiers = [...object.modifiers];
  const [moved] = modifiers.splice(from, 1);
  if (!moved) {
    return object;
  }
  modifiers.splice(to, 0, moved);
  return { ...object, modifiers };
}

export function applyModifier(object: VectorObject, modifierId: string): VectorObject {
  const index = object.modifiers.findIndex((modifier) => modifier.id === modifierId);
  if (index < 0) {
    return object;
  }
  const source = remintSource(
    evaluateSource(object.source, object.modifiers.slice(0, index + 1)).source,
  );
  return {
    ...object,
    source,
    modifiers: object.modifiers.slice(index + 1),
  };
}

export function applyAllModifiers(object: VectorObject): VectorObject {
  if (object.modifiers.length === 0) {
    return object;
  }
  return {
    ...object,
    source: remintSource(evaluateSource(object.source, object.modifiers).source),
    modifiers: [],
  };
}

function defaultArray(): Modifier {
  return {
    id: createId(),
    type: 'array',
    count: 3,
    offsetX: 40,
    offsetY: 0,
    enabled: true,
  };
}

function defaultMirror(): Modifier {
  return {
    id: createId(),
    type: 'mirror',
    axis: 'x',
    enabled: true,
  };
}

function patchModifier(modifier: Modifier, patch: ModifierPatch): Modifier {
  const enabled = patch.enabled !== undefined ? patch.enabled : modifier.enabled;
  if (modifier.type === 'array') {
    const count =
      patch.count !== undefined && Number.isFinite(patch.count)
        ? Math.max(1, Math.floor(patch.count))
        : modifier.count;
    const offsetX = finite(patch.offsetX, modifier.offsetX);
    const offsetY = finite(patch.offsetY, modifier.offsetY);
    if (
      enabled === modifier.enabled &&
      count === modifier.count &&
      offsetX === modifier.offsetX &&
      offsetY === modifier.offsetY
    ) {
      return modifier;
    }
    return { ...modifier, enabled, count, offsetX, offsetY };
  }
  if (modifier.type === 'mirror') {
    const axis = patch.axis ?? modifier.axis;
    if (enabled === modifier.enabled && axis === modifier.axis) {
      return modifier;
    }
    return { ...modifier, enabled, axis };
  }
  if (enabled === modifier.enabled) {
    return modifier;
  }
  return { ...modifier, enabled };
}

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
