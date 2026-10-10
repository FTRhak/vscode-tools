import { createId } from '../core/utils/create-id';
import { sourceToPathData } from './path-data';
import {
  Modifier,
  SourcePath,
  TraceFault,
  TraceMode,
  TraceRegion,
  TraceView,
  VectorObject,
  Vec2,
} from './types';

export const TRACE_SAMPLE_LIMIT = 384;

export interface TraceSettings {
  readonly mode: TraceMode;
  readonly colors: number;
  readonly threshold: number;
  readonly paths: number;
  readonly corners: number;
  readonly noise: number;
  readonly optimization: number;
  readonly ignoreWhite: boolean;
}

export interface TracePreset extends TraceSettings {
  readonly id: string;
  readonly label: string;
}

export interface TraceRasterInput extends TraceSettings {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

export const defaultTraceSettings: TraceSettings = {
  mode: 'color',
  colors: 16,
  threshold: 128,
  paths: 50,
  corners: 75,
  noise: 10,
  optimization: 0,
  ignoreWhite: false,
};

export const tracePresets: readonly TracePreset[] = [
  { id: 'default', label: 'Default', ...defaultTraceSettings },
  {
    id: 'high-fidelity',
    label: 'High fidelity photo',
    mode: 'color',
    colors: 30,
    threshold: 128,
    paths: 80,
    corners: 75,
    noise: 5,
    optimization: 0,
    ignoreWhite: false,
  },
  {
    id: 'low-fidelity',
    label: 'Low fidelity photo',
    mode: 'color',
    colors: 10,
    threshold: 128,
    paths: 30,
    corners: 50,
    noise: 20,
    optimization: 0,
    ignoreWhite: false,
  },
  { id: 'colors-3', label: '3 Colors', ...defaultTraceSettings, colors: 3 },
  { id: 'colors-6', label: '6 Colors', ...defaultTraceSettings, colors: 6 },
  { id: 'colors-16', label: '16 Colors', ...defaultTraceSettings, colors: 16 },
  {
    id: 'grayscale',
    label: 'Shades of gray',
    ...defaultTraceSettings,
    mode: 'grayscale',
    colors: 8,
  },
  {
    id: 'bw-logo',
    label: 'Black and white logo',
    mode: 'blackAndWhite',
    colors: 2,
    threshold: 128,
    paths: 60,
    corners: 80,
    noise: 2,
    optimization: 0,
    ignoreWhite: false,
  },
  {
    id: 'silhouette',
    label: 'Silhouette',
    mode: 'blackAndWhite',
    colors: 2,
    threshold: 128,
    paths: 50,
    corners: 75,
    noise: 20,
    optimization: 0,
    ignoreWhite: true,
  },
];

interface Sample {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/;

export function clampTraceSettings(settings: TraceSettings): TraceSettings {
  const mode = traceMode(settings.mode);
  return {
    mode,
    colors: clampInteger(settings.colors, 2, 30, defaultTraceSettings.colors),
    threshold: clampInteger(settings.threshold, 0, 255, defaultTraceSettings.threshold),
    paths: clampInteger(settings.paths, 0, 100, defaultTraceSettings.paths),
    corners: clampInteger(settings.corners, 0, 100, defaultTraceSettings.corners),
    noise: clampInteger(settings.noise, 0, 100, defaultTraceSettings.noise),
    optimization: clampInteger(settings.optimization, 0, 100, defaultTraceSettings.optimization),
    ignoreWhite: settings.ignoreWhite === true,
  };
}

export function traceRaster(input: TraceRasterInput): readonly TraceRegion[] {
  if (
    !positive(input.width) ||
    !positive(input.height) ||
    !positive(input.frameWidth) ||
    !positive(input.frameHeight) ||
    input.rgba.length < input.width * input.height * 4
  ) {
    return [];
  }
  const settings = clampTraceSettings(input);
  const sample = downsample(input.rgba, input.width, input.height, TRACE_SAMPLE_LIMIT);
  const quantized = quantize(sample, settings);
  const labels = absorbNoise(quantized.labels, sample.width, sample.height, settings.noise);
  const counts = new Map<number, number>();
  for (const label of labels) {
    if (label >= 0) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const ordered = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0]);
  const regions: TraceRegion[] = [];
  for (const [label] of ordered) {
    const fill = quantized.palette[label];
    if (!fill) {
      continue;
    }
    const source = regionSource(labels, label, sample.width, sample.height, input.frameWidth, input.frameHeight, settings);
    if (source.subpaths.length === 0) {
      continue;
    }
    regions.push({ fill, source });
  }
  return regions;
}

export function enabledTrace(object: VectorObject): Extract<Modifier, { type: 'trace' }> | null {
  const modifier = object.modifiers.find((item) => item.type === 'trace' && item.enabled);
  return modifier?.type === 'trace' ? modifier : null;
}

export function imageTraceDiagnostics(object: VectorObject): readonly string[] {
  const trace = enabledTrace(object);
  if (!trace) {
    return [];
  }
  if (!object.image?.dataUrl) {
    return ['Image to vector needs embedded pixels.'];
  }
  if (trace.fault === 'unread') {
    return ['Image to vector could not read the image.'];
  }
  if (trace.regions.length === 0) {
    return ['Image to vector has no result.'];
  }
  return [];
}

export function tracePreview(modifier: Extract<Modifier, { type: 'trace' }>): {
  readonly outlines: boolean;
  readonly paths: readonly { readonly d: string; readonly fill: string }[];
} | null {
  if (!modifier.enabled || modifier.view === 'source' || modifier.regions.length === 0) {
    return null;
  }
  return {
    outlines: modifier.view === 'outlines',
    paths: modifier.regions.flatMap((region) => {
      const d = sourceToPathData(region.source);
      return d.length > 0 ? [{ d, fill: region.fill }] : [];
    }),
  };
}

export function sanitizeTraceRegions(value: readonly TraceRegion[]): readonly TraceRegion[] {
  return value.flatMap((region) => {
    const fill = region.fill.toLowerCase();
    if (!HEX_COLOR.test(fill) || region.source.subpaths.length === 0) {
      return [];
    }
    return [{ fill, source: region.source }];
  });
}

export function traceView(value: string | undefined, fallback: TraceView): TraceView {
  return value === 'outlines' || value === 'source' || value === 'result' ? value : fallback;
}

export function traceFault(value: TraceFault | null | undefined, fallback: TraceFault | undefined): TraceFault | undefined {
  if (value === null) {
    return undefined;
  }
  return value === 'unread' ? 'unread' : fallback;
}

function quantize(sample: Sample, settings: TraceSettings): { readonly labels: Int16Array; readonly palette: readonly string[] } {
  const count = sample.width * sample.height;
  const labels = new Int16Array(count).fill(-1);
  if (settings.mode === 'blackAndWhite') {
    const palette = ['#000000', '#ffffff'];
    for (let index = 0; index < count; index += 1) {
      if (sample.rgba[index * 4 + 3] < 128) {
        continue;
      }
      const tone = luminance(sample.rgba, index);
      labels[index] = tone < settings.threshold ? 0 : 1;
    }
    return mergePalette(dropWhite(labels, palette, settings.ignoreWhite), palette);
  }
  if (settings.mode === 'grayscale') {
    const levels = settings.colors;
    const sums = Array.from({ length: levels }, () => ({ total: 0, count: 0 }));
    for (let index = 0; index < count; index += 1) {
      if (sample.rgba[index * 4 + 3] < 128) {
        continue;
      }
      const tone = luminance(sample.rgba, index);
      const bucket = Math.min(levels - 1, Math.floor((tone / 256) * levels));
      labels[index] = bucket;
      sums[bucket].total += tone;
      sums[bucket].count += 1;
    }
    const palette = sums.map((sum, index) => {
      const tone = sum.count > 0 ? sum.total / sum.count : (index + 0.5) * (255 / levels);
      return grayHex(tone);
    });
    return mergePalette(dropWhite(labels, palette, settings.ignoreWhite), palette);
  }
  if (settings.mode === 'colorDistance') {
    const selected = farthestColors(sample, settings.colors);
    return mergePalette(
      dropWhite(assignNearestColors(sample, selected), selected.map(colorHex), settings.ignoreWhite),
      selected.map(colorHex),
    );
  }
  const cut = medianCut(sample, settings.colors);
  return mergePalette(dropWhite(cut.labels, cut.palette, settings.ignoreWhite), cut.palette);
}

function farthestColors(sample: Sample, target: number): readonly number[] {
  const frequencies = new Map<number, number>();
  for (let index = 0; index < sample.width * sample.height; index += 1) {
    const offset = index * 4;
    if ((sample.rgba[offset + 3] ?? 0) < 128) {
      continue;
    }
    const color = packColor(sample.rgba[offset] ?? 0, sample.rgba[offset + 1] ?? 0, sample.rgba[offset + 2] ?? 0);
    frequencies.set(color, (frequencies.get(color) ?? 0) + 1);
  }
  const colors = [...frequencies.keys()].sort((left, right) => left - right);
  if (colors.length === 0) {
    return [];
  }
  let first = colors[0] ?? 0;
  let highestFrequency = 0;
  for (const color of colors) {
    const frequency = frequencies.get(color) ?? 0;
    if (frequency > highestFrequency) {
      first = color;
      highestFrequency = frequency;
    }
  }
  const selected = [first];
  const minDistances = new Uint32Array(colors.length);
  while (selected.length < target && selected.length < colors.length) {
    const latest = selected[selected.length - 1] ?? 0;
    let best = -1;
    let bestDistance = -1;
    for (let index = 0; index < colors.length; index += 1) {
      const color = colors[index] ?? 0;
      const distance = colorDistanceSquared(color, latest);
      minDistances[index] = Math.min(minDistances[index] || Number.MAX_SAFE_INTEGER, distance);
      if (!selected.includes(color) && minDistances[index] > bestDistance) {
        best = index;
        bestDistance = minDistances[index] ?? 0;
      }
    }
    if (best < 0) {
      break;
    }
    selected.push(colors[best] ?? 0);
  }
  return selected;
}

function assignNearestColors(sample: Sample, palette: readonly number[]): Int16Array {
  const labels = new Int16Array(sample.width * sample.height).fill(-1);
  for (let index = 0; index < labels.length; index += 1) {
    const offset = index * 4;
    if ((sample.rgba[offset + 3] ?? 0) < 128) {
      continue;
    }
    const color = packColor(sample.rgba[offset] ?? 0, sample.rgba[offset + 1] ?? 0, sample.rgba[offset + 2] ?? 0);
    let closest = 0;
    let closestDistance = Number.MAX_SAFE_INTEGER;
    for (let label = 0; label < palette.length; label += 1) {
      const distance = colorDistanceSquared(color, palette[label] ?? 0);
      if (distance < closestDistance) {
        closest = label;
        closestDistance = distance;
      }
    }
    labels[index] = closest;
  }
  return labels;
}

function packColor(red: number, green: number, blue: number): number {
  return (red << 16) | (green << 8) | blue;
}

function colorDistanceSquared(left: number, right: number): number {
  const red = ((left >> 16) & 255) - ((right >> 16) & 255);
  const green = ((left >> 8) & 255) - ((right >> 8) & 255);
  const blue = (left & 255) - (right & 255);
  return red * red + green * green + blue * blue;
}

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function medianCut(sample: Sample, target: number): { readonly labels: Int16Array; readonly palette: readonly string[] } {
  const count = sample.width * sample.height;
  const pixels: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (sample.rgba[index * 4 + 3] >= 128) {
      pixels.push(index);
    }
  }
  let buckets = [pixels];
  while (buckets.length < target) {
    let best = -1;
    let bestSpan = 0;
    let channel = 0;
    for (let index = 0; index < buckets.length; index += 1) {
      const range = channelRange(buckets[index], sample.rgba);
      if (range.span > bestSpan) {
        best = index;
        bestSpan = range.span;
        channel = range.channel;
      }
    }
    if (best < 0 || bestSpan < 1) {
      break;
    }
    const split = splitBucket(buckets[best] ?? [], sample.rgba, channel);
    if (!split) {
      break;
    }
    buckets = [...buckets.slice(0, best), split.low, split.high, ...buckets.slice(best + 1)];
  }
  const labels = new Int16Array(count).fill(-1);
  const palette = buckets.map((bucket) => {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (const index of bucket) {
      red += sample.rgba[index * 4];
      green += sample.rgba[index * 4 + 1];
      blue += sample.rgba[index * 4 + 2];
    }
    const size = bucket.length || 1;
    return hex(red / size, green / size, blue / size);
  });
  buckets.forEach((bucket, label) => {
    for (const index of bucket) {
      labels[index] = label;
    }
  });
  return { labels, palette };
}

function dropWhite(labels: Int16Array, palette: readonly string[], ignoreWhite: boolean): Int16Array {
  if (!ignoreWhite) {
    return labels;
  }
  const dropped = new Set(palette.flatMap((color, index) => (nearWhite(color) ? [index] : [])));
  if (dropped.size === 0) {
    return labels;
  }
  const next = labels.slice();
  for (let index = 0; index < next.length; index += 1) {
    if (dropped.has(next[index])) {
      next[index] = -1;
    }
  }
  return next;
}

function absorbNoise(labels: Int16Array, width: number, height: number, noise: number): Int16Array {
  if (noise <= 1) {
    return labels;
  }
  const seen = new Uint8Array(labels.length);
  const pending = new Uint8Array(labels.length);
  const next = labels.slice();
  for (let index = 0; index < labels.length; index += 1) {
    if (seen[index] || labels[index] < 0) {
      continue;
    }
    const label = labels[index];
    const stack = [index];
    const pixels: number[] = [];
    seen[index] = 1;
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) {
        break;
      }
      pixels.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (const neighbor of neighbors4(x, y, width, height)) {
        if (!seen[neighbor] && labels[neighbor] === label) {
          seen[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
    if (pixels.length < noise) {
      for (const pixel of pixels) {
        pending[pixel] = 1;
        next[pixel] = -1;
      }
    }
  }
  let guard = width * height;
  let progressed = true;
  while (progressed && guard > 0) {
    progressed = false;
    guard -= 1;
    for (let index = 0; index < pending.length; index += 1) {
      if (!pending[index]) {
        continue;
      }
      const votes = new Map<number, number>();
      const x = index % width;
      const y = Math.floor(index / width);
      for (const neighbor of neighbors4(x, y, width, height)) {
        if (pending[neighbor]) {
          continue;
        }
        const label = next[neighbor];
        if (label >= 0) {
          votes.set(label, (votes.get(label) ?? 0) + 1);
        }
      }
      const chosen = majority(votes);
      if (chosen === null) {
        continue;
      }
      next[index] = chosen;
      pending[index] = 0;
      progressed = true;
    }
  }
  return next;
}

function regionSource(
  labels: Int16Array,
  label: number,
  width: number,
  height: number,
  frameWidth: number,
  frameHeight: number,
  settings: TraceSettings,
): SourcePath {
  const loops = boundaryLoops(labels, label, width, height);
  const epsilon = ((100 - settings.paths) / 100) * 1.5 + (settings.optimization / 100) * 4;
  const radius = 0.5 + (settings.corners / 100) * 2;
  const subpaths = loops.flatMap((loop) => {
    const simplified = rdpClosed(dropCollinear(loop), epsilon);
    return simplified.length >= 3
      ? [
          toFrameSubpath(roundLoop(simplified, radius), width, height, frameWidth, frameHeight),
        ]
      : [];
  });
  return { subpaths };
}

function boundaryLoops(labels: Int16Array, label: number, width: number, height: number): Point[][] {
  const next = new Map<string, Point[]>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const key = `${x1},${y1}`;
    const list = next.get(key);
    const point = { x: x2, y: y2 };
    if (list) {
      list.push(point);
    } else {
      next.set(key, [point]);
    }
  };
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && labels[y * width + x] === label;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inside(x, y)) {
        continue;
      }
      if (!inside(x, y - 1)) {
        add(x, y, x + 1, y);
      }
      if (!inside(x + 1, y)) {
        add(x + 1, y, x + 1, y + 1);
      }
      if (!inside(x, y + 1)) {
        add(x + 1, y + 1, x, y + 1);
      }
      if (!inside(x - 1, y)) {
        add(x, y + 1, x, y);
      }
    }
  }
  const pending = new Map([...next.entries()].map(([key, points]) => [key, [...points]]));
  const loops: Point[][] = [];
  for (const startKey of next.keys()) {
    if (!pending.get(startKey)?.length) {
      continue;
    }
    const [startX, startY] = startKey.split(',').map(Number);
    const loop: Point[] = [{ x: startX, y: startY }];
    let cursor = startKey;
    let guard = next.size + 2;
    while (guard > 0) {
      guard -= 1;
      const list = pending.get(cursor);
      const step = list?.pop();
      if (!step || !list) {
        break;
      }
      if (list.length === 0) {
        pending.delete(cursor);
      }
      if (step.x === startX && step.y === startY && loop.length > 2) {
        loops.push(loop);
        break;
      }
      loop.push(step);
      cursor = `${step.x},${step.y}`;
    }
  }
  return loops;
}

interface RoundedCorner {
  readonly entry: Point;
  readonly exit: Point;
  readonly control1?: Point;
  readonly control2?: Point;
}

function roundLoop(points: readonly Point[], radius: number): SourcePath['subpaths'][number] {
  const corners = points.map((point, index): RoundedCorner => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    if (!previous || !next) {
      return { entry: point, exit: point };
    }
    const incoming = unit(point.x - previous.x, point.y - previous.y);
    const outgoing = unit(next.x - point.x, next.y - point.y);
    const dot = Math.min(1, Math.max(-1, incoming.x * outgoing.x + incoming.y * outgoing.y));
    const deflection = Math.acos(dot);
    if (deflection < 0.01 || deflection > Math.PI - 0.01) {
      return { entry: point, exit: point };
    }
    const tangent = Math.tan(deflection / 2);
    const adjacentLength = Math.min(
      Math.hypot(point.x - previous.x, point.y - previous.y),
      Math.hypot(next.x - point.x, next.y - point.y),
    );
    const trim = Math.min(radius * tangent, adjacentLength * 0.45);
    if (trim <= 0) {
      return { entry: point, exit: point };
    }
    const actualRadius = trim / tangent;
    const handleLength = (4 / 3) * actualRadius * Math.tan(deflection / 4);
    const entry = { x: point.x - incoming.x * trim, y: point.y - incoming.y * trim };
    const exit = { x: point.x + outgoing.x * trim, y: point.y + outgoing.y * trim };
    return {
      entry,
      exit,
      control1: { x: entry.x + incoming.x * handleLength, y: entry.y + incoming.y * handleLength },
      control2: { x: exit.x - outgoing.x * handleLength, y: exit.y - outgoing.y * handleLength },
    };
  });
  const groups = corners.map((corner) => {
    const entry = {
      id: createId(),
      position: corner.entry,
      handleIn: null as Vec2 | null,
      handleOut: corner.control1 ?? null,
    };
    const exit = corner.control1
      ? {
          id: createId(),
          position: corner.exit,
          handleIn: corner.control2 ?? null,
          handleOut: null as Vec2 | null,
        }
      : entry;
    return { corner, entry, exit };
  });
  const segments = groups.flatMap((group, index) => {
    const next = groups[(index + 1) % groups.length];
    if (!next) {
      return [];
    }
    const found: SourcePath['subpaths'][number]['segments'][number][] = [];
    if (group.corner.control1 && group.corner.control2 && group.entry !== group.exit) {
      found.push({
        id: createId(),
        kind: 'cubic' as const,
        fromId: group.entry.id,
        toId: group.exit.id,
      });
    }
    found.push({ id: createId(), kind: 'line' as const, fromId: group.exit.id, toId: next.entry.id });
    return found;
  });
  return {
    closed: true,
    anchors: groups.flatMap(({ entry, exit }) => (entry === exit ? [entry] : [entry, exit])),
    segments,
  };
}

function toFrameSubpath(
  subpath: SourcePath['subpaths'][number],
  width: number,
  height: number,
  frameWidth: number,
  frameHeight: number,
): SourcePath['subpaths'][number] {
  const map = (point: Vec2 | null): Vec2 | null =>
    point
      ? { x: (point.x / width) * frameWidth, y: (point.y / height) * frameHeight }
      : null;
  return {
    ...subpath,
    anchors: subpath.anchors.map((anchor) => ({
      ...anchor,
      position: map(anchor.position) ?? anchor.position,
      handleIn: map(anchor.handleIn),
      handleOut: map(anchor.handleOut),
    })),
  };
}

function dropCollinear(points: readonly Point[]): Point[] {
  if (points.length <= 3) {
    return [...points];
  }
  const kept = points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    return previous !== undefined && next !== undefined && !collinear(previous, point, next);
  });
  return kept.length >= 3 ? kept : [...points];
}

function rdpClosed(points: readonly Point[], epsilon: number): Point[] {
  if (points.length <= 4 || epsilon <= 0) {
    return [...points];
  }
  let pivot = 0;
  let best = -1;
  for (let index = 0; index < points.length; index += 1) {
    const turn = turnAngle(points, index);
    if (turn > best) {
      best = turn;
      pivot = index;
    }
  }
  const rotated = [...points.slice(pivot), ...points.slice(0, pivot)];
  const first = rotated[0];
  if (!first) {
    return [...points];
  }
  const open = rdpOpen([...rotated, first], epsilon);
  open.pop();
  return open.length >= 3 ? open : [...points];
}

function rdpOpen(points: Point[], epsilon: number): Point[] {
  const last = points.length - 1;
  if (last < 2) {
    return points;
  }
  const start = points[0];
  const end = points[last];
  if (!start || !end) {
    return points;
  }
  let farthest = 0;
  let index = 0;
  for (let cursor = 1; cursor < last; cursor += 1) {
    const point = points[cursor];
    if (!point) {
      continue;
    }
    const distance = pointLineDistance(point, start, end);
    if (distance > farthest) {
      farthest = distance;
      index = cursor;
    }
  }
  if (farthest <= epsilon || index === 0) {
    return [start, end];
  }
  const left = rdpOpen(points.slice(0, index + 1), epsilon);
  const right = rdpOpen(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

function turnAngle(points: readonly Point[], index: number): number {
  const previous = points[(index + points.length - 1) % points.length];
  const current = points[index];
  const next = points[(index + 1) % points.length];
  if (!previous || !current || !next) {
    return 0;
  }
  const incoming = unit(current.x - previous.x, current.y - previous.y);
  const outgoing = unit(next.x - current.x, next.y - current.y);
  const dot = Math.min(1, Math.max(-1, incoming.x * outgoing.x + incoming.y * outgoing.y));
  return (Math.acos(dot) * 180) / Math.PI;
}

function pointLineDistance(point: Point, start: Point, end: Point): number {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  return Math.abs((end.x - start.x) * (start.y - point.y) - (start.x - point.x) * (end.y - start.y)) / length;
}

function collinear(start: Point, middle: Point, end: Point): boolean {
  const cross = (middle.x - start.x) * (end.y - start.y) - (middle.y - start.y) * (end.x - start.x);
  return Math.abs(cross) <= 1e-6;
}

function channelRange(pixels: readonly number[], rgba: Uint8ClampedArray): { readonly channel: number; readonly span: number } {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const index of pixels) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = rgba[index * 4 + channel] ?? 0;
      min[channel] = Math.min(min[channel] ?? 255, value);
      max[channel] = Math.max(max[channel] ?? 0, value);
    }
  }
  let channel = 0;
  let span = (max[0] ?? 0) - (min[0] ?? 0);
  for (let index = 1; index < 3; index += 1) {
    const next = (max[index] ?? 0) - (min[index] ?? 0);
    if (next > span) {
      span = next;
      channel = index;
    }
  }
  return { channel, span };
}

function splitBucket(
  pixels: readonly number[],
  rgba: Uint8ClampedArray,
  channel: number,
): { readonly low: number[]; readonly high: number[] } | null {
  if (pixels.length < 2) {
    return null;
  }
  const sorted = [...pixels].sort((left, right) => (rgba[left * 4 + channel] ?? 0) - (rgba[right * 4 + channel] ?? 0));
  const valueAt = (index: number) => rgba[(sorted[index] ?? 0) * 4 + channel] ?? 0;
  const pivot = valueAt(Math.floor(sorted.length / 2));
  let cut = Math.floor(sorted.length / 2);
  while (cut > 0 && valueAt(cut - 1) === pivot) {
    cut -= 1;
  }
  if (cut === 0) {
    cut = Math.floor(sorted.length / 2);
    while (cut < sorted.length && valueAt(cut) === pivot) {
      cut += 1;
    }
  }
  if (cut <= 0 || cut >= sorted.length || valueAt(cut - 1) === valueAt(cut)) {
    return null;
  }
  return { low: sorted.slice(0, cut), high: sorted.slice(cut) };
}

function mergePalette(labels: Int16Array, palette: readonly string[]): { readonly labels: Int16Array; readonly palette: readonly string[] } {
  const remap = new Map<string, number>();
  const nextPalette: string[] = [];
  const next = new Int16Array(labels.length).fill(-1);
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index] ?? -1;
    if (label < 0) {
      continue;
    }
    const color = palette[label];
    if (!color) {
      continue;
    }
    let mapped = remap.get(color);
    if (mapped === undefined) {
      mapped = nextPalette.length;
      nextPalette.push(color);
      remap.set(color, mapped);
    }
    next[index] = mapped;
  }
  return { labels: next, palette: nextPalette };
}

function downsample(rgba: Uint8ClampedArray, width: number, height: number, limit: number): Sample {
  const edge = Math.max(width, height);
  if (edge <= limit) {
    return { width, height, rgba };
  }
  const scale = limit / edge;
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  const next = new Uint8ClampedArray(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const fromY = Math.floor((y * height) / nextHeight);
    const toY = Math.max(fromY + 1, Math.floor(((y + 1) * height) / nextHeight));
    for (let x = 0; x < nextWidth; x += 1) {
      const fromX = Math.floor((x * width) / nextWidth);
      const toX = Math.max(fromX + 1, Math.floor(((x + 1) * width) / nextWidth));
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;
      for (let py = fromY; py < toY; py += 1) {
        for (let px = fromX; px < toX; px += 1) {
          const offset = (py * width + px) * 4;
          red += rgba[offset] ?? 0;
          green += rgba[offset + 1] ?? 0;
          blue += rgba[offset + 2] ?? 0;
          alpha += rgba[offset + 3] ?? 0;
          count += 1;
        }
      }
      const offset = (y * nextWidth + x) * 4;
      const size = count || 1;
      next[offset] = red / size;
      next[offset + 1] = green / size;
      next[offset + 2] = blue / size;
      next[offset + 3] = alpha / size;
    }
  }
  return { width: nextWidth, height: nextHeight, rgba: next };
}

function neighbors4(x: number, y: number, width: number, height: number): number[] {
  const found: number[] = [];
  if (x > 0) {
    found.push(y * width + (x - 1));
  }
  if (x + 1 < width) {
    found.push(y * width + (x + 1));
  }
  if (y > 0) {
    found.push((y - 1) * width + x);
  }
  if (y + 1 < height) {
    found.push((y + 1) * width + x);
  }
  return found;
}

function majority(votes: ReadonlyMap<number, number>): number | null {
  let best: number | null = null;
  let count = 0;
  for (const [label, votesFor] of votes) {
    if (votesFor > count) {
      best = label;
      count = votesFor;
    }
  }
  return best;
}

function luminance(rgba: Uint8ClampedArray, index: number): number {
  const offset = index * 4;
  return 0.2126 * (rgba[offset] ?? 0) + 0.7152 * (rgba[offset + 1] ?? 0) + 0.0722 * (rgba[offset + 2] ?? 0);
}

function nearWhite(color: string): boolean {
  return Number.parseInt(color.slice(1, 3), 16) >= 250 && Number.parseInt(color.slice(3, 5), 16) >= 250 && Number.parseInt(color.slice(5, 7), 16) >= 250;
}

function grayHex(tone: number): string {
  return hex(tone, tone, tone);
}

function hex(red: number, green: number, blue: number): string {
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function channel(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
}

function unit(x: number, y: number): Point {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function traceMode(value: TraceMode): TraceMode {
  return value === 'colorDistance' || value === 'grayscale' || value === 'blackAndWhite' || value === 'color'
    ? value
    : 'color';
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
