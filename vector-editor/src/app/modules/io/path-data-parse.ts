import { createId } from '../../core/utils';
import { Anchor, Segment, SourcePath, Subpath, Vec2 } from '@vector-editor/modules/types';

const commandPattern = /[MmLlHhVvCcSsQqTtAaZz]/;

export function parsePathData(data: string): SourcePath {
  const cursor = new PathCursor(data);
  const subpaths: Subpath[] = [];
  let anchors: Anchor[] = [];
  let segments: Segment[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let command = '';
  let prevCubic: Vec2 | null = null;
  let prevQuad: Vec2 | null = null;
  let implicitStart = false;

  const flush = (closed: boolean): void => {
    if (anchors.length === 0) {
      return;
    }
    subpaths.push({ closed, anchors, segments });
    anchors = [];
    segments = [];
  };

  const lastAnchor = (): Anchor | undefined => anchors[anchors.length - 1];

  const ensureStart = (): void => {
    if (anchors.length > 0 || !implicitStart) {
      return;
    }
    anchors.push(makeAnchor(sx, sy, null, null));
    cx = sx;
    cy = sy;
    implicitStart = false;
  };

  while (!cursor.done()) {
    const explicit = cursor.readCommand();
    if (explicit) {
      command = explicit;
    } else if (!command) {
      break;
    }

    const relative = command === command.toLowerCase();
    const kind = command.toUpperCase();

    if (kind === 'Z') {
      closeSubpath();
      command = '';
      prevCubic = null;
      prevQuad = null;
      implicitStart = true;
      cx = sx;
      cy = sy;
      continue;
    }

    if (kind === 'M') {
      const point = readPoint(relative);
      if (!point) {
        break;
      }
      implicitStart = false;
      flush(false);
      anchors.push(makeAnchor(point.x, point.y, null, null));
      cx = point.x;
      cy = point.y;
      sx = point.x;
      sy = point.y;
      prevCubic = null;
      prevQuad = null;
      command = relative ? 'l' : 'L';
      continue;
    }

    ensureStart();
    if (anchors.length === 0) {
      break;
    }

    if (kind === 'L') {
      const point = readPoint(relative);
      if (!point) {
        break;
      }
      lineTo(point.x, point.y);
      continue;
    }

    if (kind === 'H') {
      const x = readAxis(relative, cx);
      if (x === null) {
        break;
      }
      lineTo(x, cy);
      continue;
    }

    if (kind === 'V') {
      const y = readAxis(relative, cy);
      if (y === null) {
        break;
      }
      lineTo(cx, y);
      continue;
    }

    if (kind === 'C') {
      const c1 = readPoint(relative);
      const c2 = readPoint(relative);
      const point = readPoint(relative);
      if (!c1 || !c2 || !point) {
        break;
      }
      cubicTo(c1, c2, point);
      continue;
    }

    if (kind === 'S') {
      const c2 = readPoint(relative);
      const point = readPoint(relative);
      if (!c2 || !point) {
        break;
      }
      const current = { x: cx, y: cy };
      const c1 = prevCubic ? reflectPoint(prevCubic, current) : current;
      cubicTo(c1, c2, point);
      continue;
    }

    if (kind === 'Q') {
      const control = readPoint(relative);
      const point = readPoint(relative);
      if (!control || !point) {
        break;
      }
      quadraticTo(control, point);
      continue;
    }

    if (kind === 'T') {
      const point = readPoint(relative);
      if (!point) {
        break;
      }
      const current = { x: cx, y: cy };
      const control = prevQuad ? reflectPoint(prevQuad, current) : current;
      quadraticTo(control, point);
      continue;
    }

    if (kind === 'A') {
      const rx = cursor.readNumber();
      const ry = cursor.readNumber();
      const rotation = cursor.readNumber();
      const large = cursor.readFlag();
      const sweep = cursor.readFlag();
      const point = readPoint(relative);
      if (rx === null || ry === null || rotation === null || large === null || sweep === null || !point) {
        break;
      }
      arcTo(rx, ry, rotation, large, sweep, point);
      continue;
    }

    break;
  }

  flush(false);
  return { subpaths };

  function readPoint(relative: boolean): Vec2 | null {
    const x = cursor.readNumber();
    const y = cursor.readNumber();
    if (x === null || y === null) {
      return null;
    }
    return relative ? { x: cx + x, y: cy + y } : { x, y };
  }

  function readAxis(relative: boolean, origin: number): number | null {
    const value = cursor.readNumber();
    if (value === null) {
      return null;
    }
    return relative ? origin + value : value;
  }

  function lineTo(x: number, y: number): void {
    const from = lastAnchor();
    if (!from) {
      return;
    }
    const to = makeAnchor(x, y, null, null);
    anchors.push(to);
    segments.push(makeSegment('line', from.id, to.id));
    cx = x;
    cy = y;
    prevCubic = null;
    prevQuad = null;
  }

  function cubicTo(c1: Vec2, c2: Vec2, point: Vec2): void {
    const from = lastAnchor();
    if (!from) {
      return;
    }
    anchors[anchors.length - 1] = { ...from, handleOut: c1 };
    const to = makeAnchor(point.x, point.y, c2, null);
    anchors.push(to);
    segments.push(makeSegment('cubic', from.id, to.id));
    cx = point.x;
    cy = point.y;
    prevCubic = c2;
    prevQuad = null;
  }

  function quadraticTo(control: Vec2, point: Vec2): void {
    const current = { x: cx, y: cy };
    cubicTo(elevate(current, control), elevate(point, control), point);
    prevQuad = control;
    prevCubic = null;
  }

  function arcTo(rx: number, ry: number, rotation: number, large: boolean, sweep: boolean, point: Vec2): void {
    const curves = arcCurves(cx, cy, rx, ry, rotation, large, sweep, point.x, point.y);
    if (curves.length === 0) {
      if (point.x !== cx || point.y !== cy) {
        lineTo(point.x, point.y);
      }
      return;
    }
    for (const curve of curves) {
      cubicTo(curve.c1, curve.c2, curve.point);
    }
    prevCubic = curves[curves.length - 1]?.c2 ?? null;
    prevQuad = null;
  }

  function closeSubpath(): void {
    const first = anchors[0];
    const last = lastAnchor();
    if (!first || !last) {
      flush(false);
      return;
    }
    if (last.id !== first.id && samePoint(last.position, first.position)) {
      const closing = segments[segments.length - 1];
      if (closing && closing.toId === last.id) {
        segments[segments.length - 1] = { ...closing, toId: first.id };
        anchors[0] = { ...first, handleIn: last.handleIn ?? first.handleIn };
        anchors.pop();
      }
    } else if (last.id !== first.id) {
      segments.push(makeSegment('line', last.id, first.id));
    }
    flush(true);
  }
}

interface ArcCurve {
  readonly c1: Vec2;
  readonly c2: Vec2;
  readonly point: Vec2;
}

function arcCurves(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotation: number,
  large: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): readonly ArcCurve[] {
  if (samePoint({ x: x1, y: y1 }, { x: x2, y: y2 })) {
    return [];
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) {
    return [];
  }

  const phi = (rotation * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const denominator = rxSq * y1pSq + rySq * x1pSq;
  const radicand = denominator === 0 ? 0 : (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / denominator;
  const root = Math.sqrt(Math.max(0, radicand));
  const sign = large === sweep ? -1 : 1;
  const cxp = sign * root * ((rx * y1p) / ry);
  const cyp = sign * root * (-(ry * x1p) / rx);
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) {
    delta -= Math.PI * 2;
  } else if (sweep && delta < 0) {
    delta += Math.PI * 2;
  }

  const slices = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / slices;
  const curves: ArcCurve[] = [];
  for (let index = 0; index < slices; index += 1) {
    const start = theta1 + step * index;
    const end = start + step;
    curves.push(approximateArc(cx, cy, rx, ry, phi, start, end));
  }
  const last = curves[curves.length - 1];
  if (last) {
    curves[curves.length - 1] = { ...last, point: { x: x2, y: y2 } };
  }
  return curves;
}

function approximateArc(cx: number, cy: number, rx: number, ry: number, phi: number, start: number, end: number): ArcCurve {
  const delta = end - start;
  const k = (4 / 3) * Math.tan(delta / 4);
  const map = (angle: number, dx: number, dy: number): Vec2 => {
    const x = rx * (Math.cos(angle) + dx);
    const y = ry * (Math.sin(angle) + dy);
    return {
      x: cx + x * Math.cos(phi) - y * Math.sin(phi),
      y: cy + x * Math.sin(phi) + y * Math.cos(phi),
    };
  };
  return {
    c1: map(start, -k * Math.sin(start), k * Math.cos(start)),
    c2: map(end, k * Math.sin(end), -k * Math.cos(end)),
    point: map(end, 0, 0),
  };
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (length === 0) {
    return 0;
  }
  const angle = Math.acos(Math.min(1, Math.max(-1, (ux * vx + uy * vy) / length)));
  return ux * vy - uy * vx < 0 ? -angle : angle;
}

function elevate(point: Vec2, control: Vec2): Vec2 {
  return {
    x: point.x + (2 / 3) * (control.x - point.x),
    y: point.y + (2 / 3) * (control.y - point.y),
  };
}

function reflectPoint(point: Vec2, about: Vec2): Vec2 {
  return { x: about.x * 2 - point.x, y: about.y * 2 - point.y };
}

function samePoint(left: Vec2, right: Vec2): boolean {
  return Math.abs(left.x - right.x) <= 1e-6 && Math.abs(left.y - right.y) <= 1e-6;
}

function makeAnchor(x: number, y: number, handleIn: Vec2 | null, handleOut: Vec2 | null): Anchor {
  return { id: createId(), position: { x, y }, handleIn, handleOut };
}

function makeSegment(kind: Segment['kind'], fromId: string, toId: string): Segment {
  return { id: createId(), kind, fromId, toId };
}

class PathCursor {
  private index = 0;

  constructor(private readonly data: string) {}

  done(): boolean {
    this.skipSeparators();
    return this.index >= this.data.length;
  }

  readCommand(): string | null {
    this.skipSeparators();
    const char = this.data[this.index] ?? '';
    if (!commandPattern.test(char)) {
      return null;
    }
    this.index += 1;
    return char;
  }

  readNumber(): number | null {
    this.skipSeparators();
    const match = /^[+-]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/.exec(this.data.slice(this.index));
    if (!match) {
      return null;
    }
    this.index += match[0].length;
    return Number(match[0]);
  }

  readFlag(): boolean | null {
    this.skipSeparators();
    const char = this.data[this.index] ?? '';
    if (char !== '0' && char !== '1') {
      return null;
    }
    this.index += 1;
    return char === '1';
  }

  private skipSeparators(): void {
    while (this.index < this.data.length && /[\s,]/.test(this.data[this.index] ?? '')) {
      this.index += 1;
    }
  }
}
