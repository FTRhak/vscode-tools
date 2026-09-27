import { createId } from './create-id';
import { Anchor, Document, ObjectTransform, Segment, Style, Vec2 } from './types';

const identityTransform: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

const testStyle: Style = {
  fill: '#c5d4f0',
  stroke: '#1a1a1a',
  strokeWidth: 4,
  fillRule: 'nonzero',
};

export function createNewDocument(): Document {
  const layerId = createId();
  const anchors = [
    anchor(point(450, 250), point(350, 180), point(550, 180)),
    anchor(point(750, 400), point(820, 250), point(820, 550)),
    anchor(point(450, 550), point(550, 640), point(350, 640)),
    anchor(point(250, 400), point(180, 550), point(180, 250)),
  ];

  return {
    id: createId(),
    name: 'Untitled',
    viewBox: { x: 0, y: 0, width: 1200, height: 800 },
    layers: [
      {
        id: layerId,
        name: 'Layer',
        visible: true,
        locked: false,
        order: 0,
      },
    ],
    objects: [
      {
        id: createId(),
        name: 'Path',
        layerId,
        visible: true,
        locked: false,
        source: {
          subpaths: [
            {
              closed: true,
              anchors,
              segments: [
                cubic(anchors[0], anchors[1]),
                cubic(anchors[1], anchors[2]),
                cubic(anchors[2], anchors[3]),
                cubic(anchors[3], anchors[0]),
              ],
            },
          ],
        },
        style: testStyle,
        transform: identityTransform,
        modifiers: [],
      },
    ],
    swatches: [],
  };
}

function point(x: number, y: number): Vec2 {
  return { x, y };
}

function anchor(position: Vec2, handleIn: Vec2, handleOut: Vec2): Anchor {
  return {
    id: createId(),
    position,
    handleIn,
    handleOut,
  };
}

function cubic(from: Anchor, to: Anchor): Segment {
  return {
    id: createId(),
    kind: 'cubic',
    fromId: from.id,
    toId: to.id,
  };
}
