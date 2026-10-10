import { createNewDocument } from '../create-document';
import { addLayer } from '../document-edits';
import { Anchor, Segment, SourcePath, Vec2 } from '../types';
import { addPenPoint, beginPenObject, finishPen, setPenHandles } from './pen-path';

describe('pen path', () => {
  it('starts an open object on the back layer and numbers the name', () => {
    const document = createNewDocument();

    const created = beginPenObject(document, { x: 10, y: 20 });
    const object = created?.document.objects.at(-1);

    expect(created?.objectId).toBe(object?.id);
    expect(object).toMatchObject({
      name: 'Path 2',
      layerId: document.layers[0].id,
      style: { fill: null, stroke: '#1a1a1a', strokeWidth: 4, fillRule: 'nonzero' },
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
    });
    expect(object?.source.subpaths).toEqual([
      {
        closed: false,
        anchors: [expect.objectContaining({ id: created?.anchorId, position: { x: 10, y: 20 } })],
        segments: [],
      },
    ]);
    expect(beginPenObject(created!.document, { x: 0, y: 0 })?.document.objects.at(-1)?.name).toBe('Path 3');
    expect(beginPenObject(document, { x: Number.NaN, y: 0 })).toBeNull();
    const layer = document.layers[0];
    expect(beginPenObject({ ...document, layers: [{ ...layer, locked: true }] }, { x: 1, y: 1 })).toBeNull();
    expect(beginPenObject({ ...document, layers: [{ ...layer, visible: false }] }, { x: 1, y: 1 })).toBeNull();
  });

  it('starts the stroke on the requested layer', () => {
    const document = addLayer(createNewDocument());
    const front = document.layers.find((layer) => layer.order === 1);

    const created = beginPenObject(document, { x: 4, y: 6 }, front?.id);
    expect(created?.document.objects.at(-1)?.layerId).toBe(front?.id);
    expect(beginPenObject(document, { x: 4, y: 6 }, 'missing')).toBeNull();
    expect(
      beginPenObject(
        {
          ...document,
          layers: document.layers.map((layer) => ({ ...layer, locked: layer.id === front?.id })),
        },
        { x: 4, y: 6 },
        front?.id,
      ),
    ).toBeNull();
  });

  it('adds a line when the previous anchor has no handle', () => {
    const source = openPath([anchor('a', 0, 0, null, null)]);

    const added = addPenPoint(source, { x: 30, y: 0 });

    expect(added?.anchorId).toBeTruthy();
    expect(added?.source.subpaths[0].anchors).toHaveLength(2);
    expect(added?.source.subpaths[0].segments).toEqual([expect.objectContaining({ kind: 'line', fromId: 'a', toId: added?.anchorId })]);
    const closed = { subpaths: [{ ...source.subpaths[0], closed: true }] };
    expect(addPenPoint(closed, { x: 1, y: 1 })).toBeNull();
  });

  it('adds a cubic when the previous anchor already has a handle out', () => {
    const source = openPath([anchor('a', 0, 0, null, { x: 8, y: 0 })]);

    const added = addPenPoint(source, { x: 20, y: 0 });

    expect(added?.source.subpaths[0].segments[0].kind).toBe('cubic');
  });

  it('mirrors handle in and turns the incoming segment into a cubic', () => {
    const source = openPath([anchor('a', 0, 0, null, null), anchor('b', 20, 0, null, null)], [segment('ab', 'line', 'a', 'b')]);

    const next = setPenHandles(source, 'b', { x: 30, y: 10 }, false);
    const anchorB = next.subpaths[0].anchors[1];

    expect(anchorB.handleOut).toEqual({ x: 30, y: 10 });
    expect(anchorB.handleIn).toEqual({ x: 10, y: -10 });
    expect(next.subpaths[0].segments[0].kind).toBe('cubic');
    expect(setPenHandles(next, 'b', { x: 30, y: 10 }, false)).toBe(next);
  });

  it('leaves handle in empty when the link is broken', () => {
    const source = openPath([anchor('a', 0, 0, null, null), anchor('b', 20, 0, null, null)], [segment('ab', 'line', 'a', 'b')]);

    const next = setPenHandles(source, 'b', { x: 28, y: 4 }, true);

    expect(next.subpaths[0].anchors[1].handleOut).toEqual({ x: 28, y: 4 });
    expect(next.subpaths[0].anchors[1].handleIn).toBeNull();
    expect(next.subpaths[0].segments[0].kind).toBe('line');
  });

  it('keeps a cubic incoming segment when the previous anchor has a handle out', () => {
    const source = openPath([anchor('a', 0, 0, null, { x: 6, y: 0 }), anchor('b', 20, 0, null, null)], [segment('ab', 'cubic', 'a', 'b')]);

    const next = setPenHandles(source, 'b', { x: 24, y: 0 }, true);

    expect(next.subpaths[0].segments[0].kind).toBe('cubic');
    expect(next.subpaths[0].anchors[1].handleIn).toBeNull();
  });

  it('closes with a return segment and leaves an open finish unchanged', () => {
    const source = openPath(
      [anchor('a', 0, 0, { x: -4, y: 0 }, null), anchor('b', 10, 0, null, { x: 14, y: 0 })],
      [segment('ab', 'line', 'a', 'b')],
    );

    expect(finishPen(source, false)).toBe(source);

    const closed = finishPen(source, true);
    expect(closed.subpaths[0].closed).toBe(true);
    expect(closed.subpaths[0].segments.map((item) => [item.fromId, item.toId, item.kind])).toEqual([
      ['a', 'b', 'line'],
      ['b', 'a', 'cubic'],
    ]);
    const single = openPath([anchor('a', 0, 0, null, null)]);
    expect(finishPen(single, true)).toBe(single);
  });
});

function openPath(anchors: readonly Anchor[], segments: readonly Segment[] = []): SourcePath {
  return { subpaths: [{ closed: false, anchors, segments }] };
}

function anchor(id: string, x: number, y: number, handleIn: Vec2 | null, handleOut: Vec2 | null): Anchor {
  return { id, position: { x, y }, handleIn, handleOut };
}

function segment(id: string, kind: Segment['kind'], fromId: string, toId: string): Segment {
  return { id, kind, fromId, toId };
}
