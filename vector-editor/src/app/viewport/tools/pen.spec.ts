import { Anchor, ObjectTransform, VectorObject } from '@vector-editor/core';
import { startPen, updatePenDrag } from './pen';

const identity: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

describe('pen tool', () => {
  it('starts a new object from object mode', () => {
    const started = startPen({
      mode: 'object',
      documentPoint: { x: 12, y: 8 },
      zoom: 1,
      penObject: null,
      activeObject: null,
      localPoint: null,
    });

    expect(started.place).toBe(true);
    expect(started.commands).toEqual([{ type: 'pen.begin', position: { x: 12, y: 8 } }]);
  });

  it('appends to the open active path and closes on the first anchor', () => {
    const object = pathObject(false, [anchor('a', 0, 0), anchor('b', 40, 0)]);

    const appended = startPen({
      mode: 'edit',
      documentPoint: { x: 40, y: 20 },
      zoom: 1,
      penObject: null,
      activeObject: object,
      localPoint: { x: 40, y: 20 },
    });
    expect(appended.commands).toEqual([
      { type: 'pen.addPoint', objectId: 'obj', position: { x: 40, y: 20 } },
    ]);

    const closed = startPen({
      mode: 'edit',
      documentPoint: { x: 0, y: 0 },
      zoom: 1,
      penObject: null,
      activeObject: object,
      localPoint: { x: 0, y: 6 },
    });
    expect(closed.place).toBe(false);
    expect(closed.commands).toEqual([{ type: 'pen.finish', objectId: 'obj', closed: true }]);
  });

  it('ignores a closed path in edit mode and a click on the only anchor', () => {
    const closed = pathObject(true, [anchor('a', 0, 0), anchor('b', 10, 0)]);
    expect(
      startPen({
        mode: 'edit',
        documentPoint: { x: 3, y: 3 },
        zoom: 1,
        penObject: null,
        activeObject: closed,
        localPoint: { x: 3, y: 3 },
      }).commands,
    ).toEqual([]);

    const single = pathObject(false, [anchor('a', 0, 0)]);
    expect(
      startPen({
        mode: 'edit',
        documentPoint: { x: 0, y: 0 },
        zoom: 1,
        penObject: null,
        activeObject: single,
        localPoint: { x: 1, y: 1 },
      }).commands,
    ).toEqual([]);
  });

  it('uses a screen radius that shrinks as zoom grows', () => {
    const object = pathObject(false, [anchor('a', 0, 0), anchor('b', 30, 0)]);
    const input = {
      mode: 'edit' as const,
      documentPoint: { x: 0, y: 4 },
      penObject: object,
      activeObject: null,
      localPoint: { x: 0, y: 4 },
    };

    expect(startPen({ ...input, zoom: 1 }).commands[0]?.type).toBe('pen.finish');
    expect(startPen({ ...input, zoom: 2 }).commands[0]?.type).toBe('pen.addPoint');
  });

  it('sends handle updates only after the drag threshold', () => {
    const drag = {
      pointerId: 1,
      originX: 0,
      originY: 0,
      objectId: 'obj',
      anchorId: 'b',
      moved: false,
    };

    expect(
      updatePenDrag(drag, { clientX: 3, clientY: 0, altKey: false, localPoint: { x: 3, y: 0 } }),
    ).toEqual([]);
    expect(
      updatePenDrag(drag, { clientX: 8, clientY: 2, altKey: true, localPoint: { x: 8, y: 2 } }),
    ).toEqual([
      {
        type: 'pen.setHandles',
        objectId: 'obj',
        anchorId: 'b',
        handleOut: { x: 8, y: 2 },
        breakLink: true,
        gesture: 'continue',
      },
    ]);
  });
});

function pathObject(closed: boolean, anchors: readonly Anchor[]): VectorObject {
  return {
    id: 'obj',
    name: 'Path',
    layerId: 'layer',
    visible: true,
    locked: false,
    source: {
      subpaths: [
        {
          closed,
          anchors,
          segments:
            anchors.length < 2
              ? []
              : [
                  {
                    id: 'ab',
                    kind: 'line',
                    fromId: anchors[0].id,
                    toId: anchors[1].id,
                  },
                ],
        },
      ],
    },
    style: { fill: null, stroke: '#1a1a1a', strokeWidth: 4, fillRule: 'nonzero' },
    transform: identity,
    modifiers: [],
  };
}

function anchor(id: string, x: number, y: number): Anchor {
  return { id, position: { x, y }, handleIn: null, handleOut: null };
}
