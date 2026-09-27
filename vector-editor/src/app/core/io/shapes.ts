import { createId } from '../model/create-id';
import { Anchor, Segment, SourcePath, Vec2 } from '../model/types';

const KAPPA = 0.5522847498307936;

export function primitiveToSource(element: Element): SourcePath | null {
  switch (element.localName) {
    case 'rect':
      return rectSource(element);
    case 'circle':
      return ellipseSource(
        lengthAttr(element, 'cx'),
        lengthAttr(element, 'cy'),
        lengthAttr(element, 'r'),
        lengthAttr(element, 'r'),
      );
    case 'ellipse':
      return ellipseSource(
        lengthAttr(element, 'cx'),
        lengthAttr(element, 'cy'),
        lengthAttr(element, 'rx'),
        lengthAttr(element, 'ry'),
      );
    case 'line':
      return lineSource(
        [
          { x: lengthAttr(element, 'x1'), y: lengthAttr(element, 'y1') },
          { x: lengthAttr(element, 'x2'), y: lengthAttr(element, 'y2') },
        ],
        false,
      );
    case 'polyline':
      return lineSource(readPoints(element.getAttribute('points')), false);
    case 'polygon':
      return lineSource(readPoints(element.getAttribute('points')), true);
    default:
      return null;
  }
}

function rectSource(element: Element): SourcePath | null {
  const x = lengthAttr(element, 'x');
  const y = lengthAttr(element, 'y');
  const width = lengthAttr(element, 'width');
  const height = lengthAttr(element, 'height');
  if (width <= 0 || height <= 0) {
    return null;
  }
  const rxAttr = element.getAttribute('rx');
  const ryAttr = element.getAttribute('ry');
  const rx = Math.min(
    Math.abs(rxAttr === null ? lengthAttr(element, 'ry') : lengthAttr(element, 'rx')),
    width / 2,
  );
  const ry = Math.min(
    Math.abs(ryAttr === null ? lengthAttr(element, 'rx') : lengthAttr(element, 'ry')),
    height / 2,
  );
  if (rx === 0 && ry === 0) {
    return lineSource(
      [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      true,
    );
  }
  return roundedRect(x, y, width, height, rx, ry);
}

function ellipseSource(cx: number, cy: number, rx: number, ry: number): SourcePath | null {
  if (rx <= 0 || ry <= 0) {
    return null;
  }
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;
  const anchors = [
    anchorAt({ x: cx + rx, y: cy }, { x: cx + rx, y: cy - ky }, { x: cx + rx, y: cy + ky }),
    anchorAt({ x: cx, y: cy + ry }, { x: cx + kx, y: cy + ry }, { x: cx - kx, y: cy + ry }),
    anchorAt({ x: cx - rx, y: cy }, { x: cx - rx, y: cy + ky }, { x: cx - rx, y: cy - ky }),
    anchorAt({ x: cx, y: cy - ry }, { x: cx - kx, y: cy - ry }, { x: cx + kx, y: cy - ry }),
  ];
  return {
    subpaths: [
      {
        closed: true,
        anchors,
        segments: closedCubics(anchors),
      },
    ],
  };
}

function roundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
): SourcePath {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const topLeft = anchorAt({ x: x + rx, y }, { x: x + rx - kx, y }, null);
  const topRight = anchorAt({ x: x + width - rx, y }, null, { x: x + width - rx + kx, y });
  const rightTop = anchorAt({ x: x + width, y: y + ry }, { x: x + width, y: y + ry - ky }, null);
  const rightBottom = anchorAt({ x: x + width, y: y + height - ry }, null, {
    x: x + width,
    y: y + height - ry + ky,
  });
  const bottomRight = anchorAt(
    { x: x + width - rx, y: y + height },
    { x: x + width - rx + kx, y: y + height },
    null,
  );
  const bottomLeft = anchorAt({ x: x + rx, y: y + height }, null, {
    x: x + rx - kx,
    y: y + height,
  });
  const leftBottom = anchorAt({ x, y: y + height - ry }, { x, y: y + height - ry + ky }, null);
  const leftTop = anchorAt({ x, y: y + ry }, null, { x, y: y + ry - ky });
  const anchors = [
    topLeft,
    topRight,
    rightTop,
    rightBottom,
    bottomRight,
    bottomLeft,
    leftBottom,
    leftTop,
  ];
  const kinds: Array<Segment['kind']> = [
    'line',
    'cubic',
    'line',
    'cubic',
    'line',
    'cubic',
    'line',
    'cubic',
  ];
  return {
    subpaths: [
      {
        closed: true,
        anchors,
        segments: kinds.map((kind, index) =>
          segment(kind, anchors[index], anchors[(index + 1) % anchors.length]),
        ),
      },
    ],
  };
}

function lineSource(points: readonly Vec2[], closed: boolean): SourcePath | null {
  if (points.length < 2) {
    return null;
  }
  const anchors = points.map((point) => anchorAt(point, null, null));
  const segments: Segment[] = [];
  for (let index = 0; index < anchors.length - 1; index += 1) {
    segments.push(segment('line', anchors[index], anchors[index + 1]));
  }
  if (closed) {
    segments.push(segment('line', anchors[anchors.length - 1], anchors[0]));
  }
  return { subpaths: [{ closed, anchors, segments }] };
}

function closedCubics(anchors: readonly Anchor[]): Segment[] {
  return anchors.map((item, index) =>
    segment('cubic', item, anchors[(index + 1) % anchors.length]),
  );
}

function readPoints(value: string | null): Vec2[] {
  if (!value) {
    return [];
  }
  const numbers = [...value.matchAll(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)].map((match) =>
    Number(match[0]),
  );
  const points: Vec2[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }
  return points;
}

function lengthAttr(element: Element, name: string): number {
  const raw = element.getAttribute(name);
  if (raw === null) {
    return 0;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function anchorAt(position: Vec2, handleIn: Vec2 | null, handleOut: Vec2 | null): Anchor {
  return { id: createId(), position, handleIn, handleOut };
}

function segment(kind: Segment['kind'], from: Anchor, to: Anchor): Segment {
  return { id: createId(), kind, fromId: from.id, toId: to.id };
}
