import { createNewDocument } from '../create-document';
import {
  addShape,
  clampShapeCount,
  ELLIPSE_KAPPA,
  shapeSource,
  shapeSourceFromDrag,
  ShapeDrag,
} from '.';
import { SourcePath, Vec2 } from '../types';

describe('shape geometry', () => {
  it('constrains a rectangle to a square and an ellipse to a circle', () => {
    const square = shapeSourceFromDrag(drag('rectangle', { x: 0, y: 0 }, { x: 40, y: 10 }, true));
    expect(positions(square)).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ]);
    expect(square?.subpaths[0]?.segments.every((segment) => segment.kind === 'line')).toBe(true);
    expect(square?.subpaths[0]?.closed).toBe(true);

    const circle = shapeSourceFromDrag(drag('ellipse', { x: 0, y: 0 }, { x: 10, y: 4 }, true));
    const anchors = circle?.subpaths[0]?.anchors ?? [];
    expect(anchors.map((anchor) => anchor.position)).toEqual([
      { x: 10, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 5 },
      { x: 5, y: 0 },
    ]);
    expect(anchors[0]?.handleOut).toEqual({ x: 10, y: 5 + ELLIPSE_KAPPA * 5 });
    expect(circle?.subpaths[0]?.segments.every((segment) => segment.kind === 'cubic')).toBe(true);
  });

  it('draws a rectangle from the center when asked', () => {
    const source = shapeSourceFromDrag({
      ...drag('rectangle', { x: 50, y: 50 }, { x: 70, y: 60 }, false),
      fromCenter: true,
    });
    expect(positions(source)).toEqual([
      { x: 30, y: 40 },
      { x: 70, y: 40 },
      { x: 70, y: 60 },
      { x: 30, y: 60 },
    ]);
  });

  it('builds a rhombus with equal sides, and a square diamond when constrained', () => {
    const rhombus = shapeSourceFromDrag(drag('rhombus', { x: 0, y: 0 }, { x: 40, y: 20 }, false));
    const corners = positions(rhombus);
    expect(corners).toEqual([
      { x: 20, y: 0 },
      { x: 40, y: 10 },
      { x: 20, y: 20 },
      { x: 0, y: 10 },
    ]);
    expect(sideLengths(corners).every((length) => Math.abs(length - sideLengths(corners)[0]) < 1e-9)).toBe(
      true,
    );

    const diamond = positions(shapeSourceFromDrag(drag('rhombus', { x: 0, y: 0 }, { x: 40, y: 10 }, true)));
    expect(Math.hypot(diamond[2].x - diamond[0].x, diamond[2].y - diamond[0].y)).toBeCloseTo(40);
    expect(Math.hypot(diamond[3].x - diamond[1].x, diamond[3].y - diamond[1].y)).toBeCloseTo(40);
  });

  it('builds stars of 3 and 32 points and polygons of 3 and 64 sides', () => {
    for (const points of [3, 32]) {
      const star = shapeSourceFromDrag({
        ...drag('star', { x: 0, y: 0 }, { x: 0, y: -20 }, false),
        count: points,
        innerRatio: 0.5,
      });
      expect(star?.subpaths[0]?.anchors).toHaveLength(points * 2);
      expect(star?.subpaths[0]?.closed).toBe(true);
      const distances = (star?.subpaths[0]?.anchors ?? []).map((anchor) =>
        Math.hypot(anchor.position.x, anchor.position.y),
      );
      distances.forEach((distance, index) => {
        expect(distance).toBeCloseTo(index % 2 === 0 ? 20 : 10);
      });
    }

    for (const sides of [3, 64]) {
      const polygon = shapeSourceFromDrag({
        ...drag('polygon', { x: 0, y: 0 }, { x: 30, y: 0 }, false),
        count: sides,
      });
      expect(polygon?.subpaths[0]?.anchors).toHaveLength(sides);
      for (const anchor of polygon?.subpaths[0]?.anchors ?? []) {
        expect(Math.hypot(anchor.position.x, anchor.position.y)).toBeCloseTo(30);
      }
    }
  });

  it('locks a star point upward and a polygon side horizontal', () => {
    const star = shapeSourceFromDrag({
      ...drag('star', { x: 0, y: 0 }, { x: 40, y: 0 }, true),
      count: 5,
      innerRatio: 0.5,
    });
    expect(star?.subpaths[0]?.anchors[0]?.position.x).toBeCloseTo(0);
    expect(star?.subpaths[0]?.anchors[0]?.position.y).toBeCloseTo(-40);

    const polygon = shapeSourceFromDrag({
      ...drag('polygon', { x: 0, y: 0 }, { x: 30, y: 10 }, true),
      count: 6,
    });
    const vertices = positions(polygon);
    const bottom = Math.max(...vertices.map((point) => point.y));
    const onBottom = vertices.filter((point) => Math.abs(point.y - bottom) < 1e-9);
    expect(onBottom).toHaveLength(2);
    expect(onBottom[0].y).toBeCloseTo(onBottom[1].y);
  });

  it('uses an explicit inner radius for a star and clamps point counts', () => {
    const star = shapeSourceFromDrag({
      ...drag('star', { x: 0, y: 0 }, { x: 10, y: 0 }, false),
      count: 5,
      outerRadius: 40,
      innerRadius: 10,
    });
    const distances = (star?.subpaths[0]?.anchors ?? []).map((anchor) =>
      Math.hypot(anchor.position.x, anchor.position.y),
    );
    expect(distances[0]).toBeCloseTo(40);
    expect(distances[1]).toBeCloseTo(10);
    expect(clampShapeCount('star', 2)).toBe(3);
    expect(clampShapeCount('star', 40)).toBe(32);
    expect(clampShapeCount('polygon', 1)).toBe(3);
    expect(clampShapeCount('polygon', 80)).toBe(64);
  });

  it('rejects a zero-size drag or placement', () => {
    expect(shapeSourceFromDrag(drag('rectangle', { x: 5, y: 5 }, { x: 5, y: 5 }, false))).toBeNull();
    expect(
      shapeSource({
        kind: 'ellipse',
        origin: { x: 0, y: 0 },
        width: 0,
        height: 10,
        radius: 10,
        innerRadius: 5,
        count: 5,
      }),
    ).toBeNull();
    expect(
      shapeSource({
        kind: 'star',
        origin: { x: 0, y: 0 },
        width: 10,
        height: 10,
        radius: 0,
        innerRadius: 0,
        count: 5,
      }),
    ).toBeNull();
  });

  it('places a numbered path and refuses a locked layer', () => {
    const document = createNewDocument();
    const layerId = document.layers[0].id;
    const source = shapeSource({
      kind: 'rectangle',
      origin: { x: 1, y: 2 },
      width: 10,
      height: 8,
      radius: 1,
      innerRadius: 1,
      count: 4,
    });
    const created = source && addShape(document, 'Rectangle', source, layerId);
    const object = created?.document.objects.find((item) => item.id === created.objectId);
    expect(object).toMatchObject({
      name: 'Rectangle',
      kind: 'path',
      layerId,
      modifiers: [],
      style: { fill: '#c5d4f0', stroke: '#1a1a1a', strokeWidth: 4 },
    });
    expect(object?.source.subpaths[0]?.closed).toBe(true);

    const second = source && created && addShape(created.document, 'Rectangle', source, layerId);
    expect(second?.document.objects.at(-1)?.name).toBe('Rectangle 2');

    const locked = {
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, locked: true })),
    };
    expect(source && addShape(locked, 'Rectangle', source, layerId)).toBeNull();
    expect(addShape(document, 'Rectangle', { subpaths: [] }, layerId)).toBeNull();
  });
});

function drag(kind: ShapeDrag['kind'], origin: Vec2, current: Vec2, constrain: boolean): ShapeDrag {
  return {
    kind,
    origin,
    current,
    fromCenter: false,
    constrain,
    count: 5,
    innerRatio: 0.5,
    outerRadius: null,
    innerRadius: null,
  };
}

function positions(source: SourcePath | null): Vec2[] {
  return source?.subpaths[0]?.anchors.map((anchor) => anchor.position) ?? [];
}

function sideLengths(points: readonly Vec2[]): number[] {
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
}
