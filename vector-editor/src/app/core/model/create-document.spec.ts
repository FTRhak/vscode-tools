import { createNewDocument } from './create-document';
import { sourceToPathData } from './path-data';

describe('createNewDocument', () => {
  it('builds a 1200 by 800 sheet with one closed cubic path', () => {
    const document = createNewDocument();

    expect(document.name).toBe('Untitled');
    expect(document.viewBox).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
    expect(document.layers).toHaveLength(1);
    expect(document.swatches).toEqual([]);
    expect(document.objects).toHaveLength(1);

    const object = document.objects[0];
    expect(object?.layerId).toBe(document.layers[0]?.id);
    expect(object?.visible).toBe(true);
    expect(object?.modifiers).toEqual([]);
    expect(object?.transform).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });

    const subpath = object?.source.subpaths[0];
    expect(object?.source.subpaths).toHaveLength(1);
    expect(subpath?.closed).toBe(true);
    expect(subpath?.anchors).toHaveLength(4);
    expect(subpath?.segments).toHaveLength(4);
    expect(subpath?.segments.every((segment) => segment.kind === 'cubic')).toBe(true);

    for (const anchor of subpath?.anchors ?? []) {
      expect(anchor.position.x).toBeGreaterThanOrEqual(180);
      expect(anchor.position.x).toBeLessThanOrEqual(820);
      expect(anchor.position.y).toBeGreaterThanOrEqual(180);
      expect(anchor.position.y).toBeLessThanOrEqual(640);
    }

    expect(sourceToPathData(object?.source ?? { subpaths: [] })).toContain('C ');
    expect(sourceToPathData(object?.source ?? { subpaths: [] })).toContain('Z');
  });

  it('assigns a new document id on each call', () => {
    expect(createNewDocument().id).not.toBe(createNewDocument().id);
  });

  it('uses the requested view size and falls back when a size is not positive', () => {
    expect(createNewDocument({ width: 640, height: 480 }).viewBox).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 480,
    });
    expect(createNewDocument({ width: 0, height: -20 }).viewBox).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    });
  });
});
