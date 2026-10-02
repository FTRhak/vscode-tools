import { createNewDocument } from '../model/create-document';
import { addEmptyPoint } from '../model/empty-point';
import { Document, SourcePath, Vec2, VectorObject } from '../model/types';
import { parsePathData } from './path-data-parse';
import { exportSvg } from './svg-export';
import { importSvg } from './svg-import';

describe('parsePathData', () => {
  it('reads relative lines and axis commands', () => {
    const source = parsePathData('m 10 20 h 5 v 5 l 1 1');
    expect(positions(source)).toEqual([
      [
        { x: 10, y: 20 },
        { x: 15, y: 20 },
        { x: 15, y: 25 },
        { x: 16, y: 26 },
      ],
    ]);
    expect(source.subpaths[0]?.segments.every((segment) => segment.kind === 'line')).toBe(true);
  });

  it('expands smooth cubics and quadratic commands', () => {
    const smooth = parsePathData('M 0 0 C 10 0 20 0 30 0 S 50 0 60 0');
    expect(handles(smooth)).toEqual([
      { position: { x: 0, y: 0 }, handleIn: null, handleOut: { x: 10, y: 0 } },
      { position: { x: 30, y: 0 }, handleIn: { x: 20, y: 0 }, handleOut: { x: 40, y: 0 } },
      { position: { x: 60, y: 0 }, handleIn: { x: 50, y: 0 }, handleOut: null },
    ]);

    const quadratic = parsePathData('M 0 0 Q 30 30 60 0');
    expect(handles(quadratic)).toEqual([
      { position: { x: 0, y: 0 }, handleIn: null, handleOut: { x: 20, y: 20 } },
      { position: { x: 60, y: 0 }, handleIn: { x: 40, y: 20 }, handleOut: null },
    ]);

    const reflected = parsePathData('M 0 0 Q 0 30 30 30 T 60 30');
    expect(handles(reflected)[1]).toEqual({
      position: { x: 30, y: 30 },
      handleIn: { x: 10, y: 30 },
      handleOut: { x: 50, y: 30 },
    });
    expect(handles(reflected)[2]?.handleIn).toEqual({ x: 60, y: 30 });
  });

  it('approximates a quarter-circle arc with a cubic', () => {
    const source = parsePathData('M 1 0 A 1 1 0 0 1 0 1');
    const subpath = source.subpaths[0];
    const start = subpath?.anchors[0];
    const end = subpath?.anchors[1];
    expect(subpath?.segments).toHaveLength(1);
    expect(start?.position).toEqual({ x: 1, y: 0 });
    expect(end?.position).toEqual({ x: 0, y: 1 });
    const mid = cubicAt(
      start?.position ?? { x: 0, y: 0 },
      start?.handleOut ?? { x: 0, y: 0 },
      end?.handleIn ?? { x: 0, y: 0 },
      end?.position ?? { x: 0, y: 0 },
      0.5,
    );
    expect(Math.hypot(mid.x, mid.y)).toBeCloseTo(1, 2);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.y).toBeGreaterThan(0);
  });
});

describe('importSvg', () => {
  it('turns rect and circle into closed paths and counts a text node', () => {
    const result = importSvg(`
      <svg viewBox="0 0 100 100">
        <rect x="1" y="2" width="3" height="4" fill="#abc" stroke="none"/>
        <text>Hi</text>
        <circle cx="20" cy="30" r="5" fill="none" stroke="#111"/>
      </svg>
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.skipped).toBe(1);
    expect(result.document.objects).toHaveLength(2);
    expect(result.document.layers).toHaveLength(1);
    const [rect, circle] = result.document.objects;
    expect(positions(rect?.source ?? empty)).toEqual([
      [
        { x: 1, y: 2 },
        { x: 4, y: 2 },
        { x: 4, y: 6 },
        { x: 1, y: 6 },
      ],
    ]);
    expect(rect?.source.subpaths[0]?.closed).toBe(true);
    expect(rect?.style).toEqual({
      fill: '#abc',
      stroke: null,
      strokeWidth: 1,
      fillRule: 'nonzero',
    });
    expect(circle?.source.subpaths[0]?.anchors).toHaveLength(4);
    expect(circle?.source.subpaths[0]?.closed).toBe(true);
    expect(circle?.source.subpaths[0]?.segments.every((segment) => segment.kind === 'cubic')).toBe(
      true,
    );
    expect(circle?.source.subpaths[0]?.anchors[0]?.position).toEqual({ x: 25, y: 30 });
  });

  it('bakes group transforms and keeps interleaved layers in paint order', () => {
    const result = importSvg(`
      <svg viewBox="0 0 50 50">
        <rect x="0" y="0" width="1" height="1"/>
        <g id="Artwork">
          <g transform="translate(10 0)">
            <rect x="0" y="0" width="2" height="2"/>
          </g>
        </g>
        <rect x="3" y="0" width="1" height="1"/>
      </svg>
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.document.layers.map((layer) => layer.name)).toEqual([
      'Layer',
      'Artwork',
      'Layer',
    ]);
    expect(
      result.document.objects.map((object) => object.source.subpaths[0]?.anchors[0]?.position),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(result.document.objects.every((object) => object.transform.x === 0)).toBe(true);
  });

  it('rejects a file that is not an svg document', () => {
    expect(importSvg('').ok).toBe(false);
    expect(importSvg('<html></html>').ok).toBe(false);
    expect(importSvg('<svg>').ok).toBe(false);
  });
});

describe('exportSvg', () => {
  it('round-trips assigned radial gradients, proportions, and translucent stops', () => {
    const base = sampleDocument();
    const gradient = {
      id: 'gradient-1',
      name: 'Sunset',
      type: 'radial' as const,
      angle: 0,
      proportions: 1.4,
      stops: [
        { id: 'stop-a', offset: 0, color: '#f0523a', opacity: 1 },
        { id: 'stop-b', offset: 0.35, color: '#fff000', opacity: 0.45 },
        { id: 'stop-c', offset: 1, color: '#3974d5', opacity: 0.8 },
      ],
    };
    const firstObject = base.objects[0];
    const document: Document = {
      ...base,
      gradients: [gradient],
      objects: base.objects.map((object) =>
        object === firstObject
          ? { ...object, style: { ...object.style, fill: `url(#${gradient.id})` } }
          : object,
      ),
    };

    for (const mode of ['all', 'minimal'] as const) {
      const svg = exportSvg(document, mode);
      expect(svg).toContain('<radialGradient');
      expect(svg).toContain(`fill="url(#${gradient.id})"`);
      const result = importSvg(svg);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.document.gradients).toEqual([gradient]);
        expect(result.document.objects[0]?.style.fill).toBe(`url(#${gradient.id})`);
      }
    }
  });

  it('round-trips all editor data and ignores the baked path cache', () => {
    const document = sampleDocument();
    const svg = exportSvg(document, 'all');
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const paths = [...parsed.getElementsByTagName('path')];
    expect(paths[0]?.getAttribute('d')).toBe('M 15 10 C 17 8 23 14 25 10');
    expect(paths.every((path) => path.getAttribute('transform') === null)).toBe(true);

    const result = importSvg(svg);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const imported = result.document;
    expect(imported.id).toBe(document.id);
    expect(imported.name).toBe('Poster');
    expect(imported.swatches).toEqual(document.swatches);
    expect(imported.layers.map((layer) => ({ ...layer }))).toEqual(
      document.layers.map((layer) => ({ ...layer })),
    );
    expect(imported.objects.map(geometry)).toEqual(document.objects.map(geometry));
    expect(imported.objects.map((object) => object.modifiers)).toEqual([[], []]);
  });

  it('keeps optimized geometry without swatches, locks, or ids', () => {
    const document = sampleDocument();
    const svg = exportSvg(document, 'optimized');
    expect(svg).not.toContain('#abcdef');
    expect(svg).not.toContain('object-1');
    expect(svg).not.toContain('"locked"');

    const result = importSvg(svg);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const imported = result.document;
    expect(imported.id).not.toBe(document.id);
    expect(imported.swatches).toEqual([]);
    expect(imported.objects.map((object) => object.locked)).toEqual([false, false]);
    expect(imported.objects.map((object) => object.id)).not.toEqual(
      document.objects.map((object) => object.id),
    );
    expect(imported.layers.map((layer) => layer.name)).toEqual(['Back', 'Front']);
    expect(imported.layers.every((layer) => layer.locked === false)).toBe(true);
    expect(imported.objects.map((object) => object.visible)).toEqual([true, false]);
    expect(
      imported.objects.map((object) => ({
        name: object.name,
        transform: object.transform,
        positions: positions(object.source),
        handles: handles(object.source),
      })),
    ).toEqual(
      document.objects.map((object) => ({
        name: object.name,
        transform: object.transform,
        positions: positions(object.source),
        handles: handles(object.source),
      })),
    );
  });

  it('writes only visible paths for minimal saves and imports them as one layer', () => {
    const document = sampleDocument();
    const svg = exportSvg(document, 'minimal');
    expect(svg).not.toContain('data-vector-editor');
    expect(svg).not.toContain('<g');
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg).toContain('M 15 10 C 17 8 23 14 25 10');

    const result = importSvg(svg);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.document.layers).toHaveLength(1);
    expect(result.document.objects).toHaveLength(1);
    expect(result.document.objects[0]?.transform).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
    });
    expect(result.document.objects[0]?.source.subpaths[0]?.anchors[0]?.position).toEqual({
      x: 15,
      y: 10,
    });
  });

  it('round-trips an empty point without turning it into path geometry', () => {
    const created = addEmptyPoint(createNewDocument(), { x: 40, y: 70 });
    const document = created?.document;
    expect(document).toBeDefined();
    if (!document) {
      return;
    }

    const svg = exportSvg(document, 'all');
    expect(svg).toContain('M 40 70');
    expect(svg).toContain('&quot;kind&quot;:&quot;empty&quot;');

    const result = importSvg(svg);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const point = result.document.objects.find((object) => object.kind === 'empty');
    expect(point).toMatchObject({
      name: 'Empty Point',
      source: { subpaths: [] },
      modifiers: [],
      transform: { x: 40, y: 70, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
    });

    const optimized = importSvg(exportSvg(document, 'optimized'));
    expect(optimized.ok).toBe(true);
    if (!optimized.ok) {
      return;
    }
    expect(optimized.document.objects.some((object) => object.kind === 'empty')).toBe(true);
    expect(
      optimized.document.objects.find((object) => object.kind === 'empty')?.transform,
    ).toMatchObject({ x: 40, y: 70 });

    expect(exportSvg(document, 'minimal')).not.toContain('"kind":"empty"');
  });

  it('round-trips the new-document curve with the same anchors', () => {
    const document = createNewDocument();
    const result = importSvg(exportSvg(document, 'all'));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.document.objects.map(geometry)).toEqual(document.objects.map(geometry));
    expect(result.document.layers).toEqual(document.layers);
  });

  it('writes evaluated geometry and restores an array stack', () => {
    const document = withArray(sampleDocument());
    const svg = exportSvg(document, 'all');
    expect(svg).toContain('mod-array');
    expect(svg).toContain('M 15 10 C 17 8 23 14 25 10');
    expect(svg).toContain('M 25 10 C 27 8 33 14 35 10');

    const result = importSvg(svg);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.document.objects[0]?.modifiers).toEqual(document.objects[0]?.modifiers);
    expect(result.document.objects[0]?.source).toEqual(document.objects[0]?.source);
  });

  it('assigns new ids to optimized modifiers and bakes minimal geometry', () => {
    const document = withArray(sampleDocument());
    const optimized = exportSvg(document, 'optimized');
    expect(optimized).not.toContain('mod-array');
    const optimizedResult = importSvg(optimized);
    expect(optimizedResult.ok).toBe(true);
    if (!optimizedResult.ok) {
      return;
    }
    expect(optimizedResult.document.objects[0]?.modifiers[0]).toMatchObject({
      type: 'array',
      count: 2,
      offsetX: 10,
      offsetY: 0,
      enabled: true,
    });
    expect(optimizedResult.document.objects[0]?.modifiers[0]?.id).not.toBe('mod-array');

    const minimal = exportSvg(document, 'minimal');
    expect(minimal).not.toContain('data-vector-editor');
    expect(minimal).toContain('M 25 10 C 27 8 33 14 35 10');
  });

  it('restores modifier settings and defaults older round modes to direct', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <path d="M 0 0 L 4 0" fill="none" stroke="#000"
          data-vector-editor='{"version":1,"name":"Path","source":{"subpaths":[{"closed":false,"anchors":[{"id":"a","position":{"x":0,"y":0},"handleIn":null,"handleOut":null},{"id":"b","position":{"x":1,"y":0},"handleIn":null,"handleOut":null}],"segments":[{"id":"s","kind":"line","fromId":"a","toId":"b"}]}]},"transform":{"x":3,"y":0,"rotation":0,"scaleX":1,"scaleY":1},"modifiers":[{"id":"arr-1","type":"array","count":4.8,"offsetX":2,"offsetY":3,"enabled":false},{"id":"mir-1","type":"mirror","axis":"y"},{"id":"round-1","type":"round","mode":"circle","anchorCount":8,"roundness":75},{"id":"round-2","type":"round","anchorCount":4,"roundness":50},{"type":"bevel","distance":1},{"type":"boolean","operation":"union","operandId":"missing"},{"type":"array"}],"locked":true}' />
      </svg>
    `;
    const result = importSvg(svg);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.document.objects[0]?.modifiers).toEqual([
      {
        id: 'arr-1',
        type: 'array',
        count: 4,
        offsetX: 2,
        offsetY: 3,
        enabled: false,
      },
      { id: 'mir-1', type: 'mirror', axis: 'y', enabled: true },
      {
        id: 'round-1',
        type: 'round',
        mode: 'circle',
        anchorCount: 8,
        roundness: 75,
        enabled: true,
      },
      {
        id: 'round-2',
        type: 'round',
        mode: 'direct',
        anchorCount: 4,
        roundness: 50,
        enabled: true,
      },
      {
        id: expect.any(String),
        type: 'boolean',
        operation: 'union',
        operandId: 'missing',
        enabled: true,
      },
    ]);
    expect(result.document.objects[0]?.locked).toBe(true);
    expect(result.document.objects[0]?.transform.x).toBe(3);
    expect(result.document.objects[0]?.source.subpaths[0]?.anchors[1]?.position).toEqual({
      x: 1,
      y: 0,
    });
  });

  it('round-trips bevel and boolean, and remaps an optimized operand', () => {
    const owner = object('owner', 'Owner', 'layer-back', true, false, squareSource('owner'), {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
    });
    const operand = object(
      'operand',
      'Operand',
      'layer-front',
      true,
      false,
      squareSource('operand'),
      { x: 2, y: 2, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
    );
    const document: Document = {
      ...sampleDocument(),
      swatches: [],
      objects: [
        {
          ...owner,
          style: { ...owner.style, fillRule: 'nonzero' },
          modifiers: [
            {
              id: 'mod-bevel',
              type: 'bevel',
              distance: 1,
              join: 'bevel',
              miterLimit: 4,
              enabled: true,
            },
            {
              id: 'mod-boolean',
              type: 'boolean',
              operation: 'difference',
              operandId: 'operand',
              enabled: true,
            },
          ],
        },
        operand,
      ],
    };

    const all = exportSvg(document, 'all');
    const allResult = importSvg(all);
    expect(allResult.ok).toBe(true);
    if (!allResult.ok) {
      return;
    }
    expect(allResult.document.objects[0]?.modifiers).toEqual(document.objects[0]?.modifiers);
    expect(allResult.document.objects[0]?.style.fillRule).toBe('evenodd');

    const optimized = exportSvg(document, 'optimized');
    expect(optimized).toContain('operandIndex&quot;:1');
    expect(optimized).not.toContain('mod-boolean');
    const optimizedResult = importSvg(optimized);
    expect(optimizedResult.ok).toBe(true);
    if (!optimizedResult.ok) {
      return;
    }
    const importedOperand = optimizedResult.document.objects[1];
    expect(optimizedResult.document.objects[0]?.modifiers[1]).toMatchObject({
      type: 'boolean',
      operation: 'difference',
      operandId: importedOperand?.id,
    });
    expect(optimizedResult.document.objects[0]?.modifiers[1]?.id).not.toBe('mod-boolean');

    const minimal = exportSvg(document, 'minimal');
    expect(minimal).not.toContain('data-vector-editor');
    expect(minimal).toContain('fill-rule="evenodd"');
    const minimalResult = importSvg(minimal);
    expect(minimalResult.ok).toBe(true);
    if (!minimalResult.ok) {
      return;
    }
    expect(minimalResult.document.objects[0]?.modifiers).toEqual([]);
    expect(minimalResult.document.objects[0]?.source.subpaths[0]?.segments[0]?.kind).toBe('line');
  });
});

function withArray(document: Document): Document {
  return {
    ...document,
    objects: document.objects.map((item, index) =>
      index === 0
        ? {
            ...item,
            modifiers: [
              {
                id: 'mod-array',
                type: 'array',
                count: 2,
                offsetX: 10,
                offsetY: 0,
                enabled: true,
              },
            ],
          }
        : item,
    ),
  };
}

function sampleDocument(): Document {
  return {
    id: 'doc-1',
    name: 'Poster',
    viewBox: { x: 0, y: 0, width: 200, height: 100 },
    layers: [
      { id: 'layer-back', name: 'Back', visible: true, locked: false, order: 0 },
      { id: 'layer-front', name: 'Front', visible: true, locked: true, order: 1 },
    ],
    swatches: [{ id: 'swatch-1', name: 'Blue', color: '#abcdef' }],
    gradients: [],
    objects: [
      object(
        'object-1',
        'Curve',
        'layer-back',
        true,
        false,
        {
          subpaths: [
            {
              closed: false,
              anchors: [
                {
                  id: 'anchor-a',
                  position: { x: 10, y: 10 },
                  handleIn: null,
                  handleOut: { x: 12, y: 8 },
                },
                {
                  id: 'anchor-b',
                  position: { x: 20, y: 10 },
                  handleIn: { x: 18, y: 14 },
                  handleOut: null,
                },
              ],
              segments: [{ id: 'segment-1', kind: 'cubic', fromId: 'anchor-a', toId: 'anchor-b' }],
            },
          ],
        },
        { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
      ),
      object(
        'object-2',
        'Mark',
        'layer-front',
        false,
        true,
        {
          subpaths: [
            {
              closed: true,
              anchors: [
                { id: 'anchor-c', position: { x: 0, y: 0 }, handleIn: null, handleOut: null },
                { id: 'anchor-d', position: { x: 4, y: 0 }, handleIn: null, handleOut: null },
                { id: 'anchor-e', position: { x: 0, y: 4 }, handleIn: null, handleOut: null },
              ],
              segments: [
                { id: 'segment-2', kind: 'line', fromId: 'anchor-c', toId: 'anchor-d' },
                { id: 'segment-3', kind: 'line', fromId: 'anchor-d', toId: 'anchor-e' },
                { id: 'segment-4', kind: 'line', fromId: 'anchor-e', toId: 'anchor-c' },
              ],
            },
          ],
        },
        { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1, originX: 0, originY: 0 },
      ),
    ],
  };
}

function squareSource(id: string): SourcePath {
  return {
    subpaths: [
      {
        closed: true,
        anchors: [
          { id: `${id}-a`, position: { x: 0, y: 0 }, handleIn: null, handleOut: null },
          { id: `${id}-b`, position: { x: 8, y: 0 }, handleIn: null, handleOut: null },
          { id: `${id}-c`, position: { x: 8, y: 8 }, handleIn: null, handleOut: null },
          { id: `${id}-d`, position: { x: 0, y: 8 }, handleIn: null, handleOut: null },
        ],
        segments: [
          { id: `${id}-0`, kind: 'line', fromId: `${id}-a`, toId: `${id}-b` },
          { id: `${id}-1`, kind: 'line', fromId: `${id}-b`, toId: `${id}-c` },
          { id: `${id}-2`, kind: 'line', fromId: `${id}-c`, toId: `${id}-d` },
          { id: `${id}-3`, kind: 'line', fromId: `${id}-d`, toId: `${id}-a` },
        ],
      },
    ],
  };
}

function object(
  id: string,
  name: string,
  layerId: string,
  visible: boolean,
  locked: boolean,
  source: SourcePath,
  transform: VectorObject['transform'],
): VectorObject {
  return {
    id,
    name,
    layerId,
    visible,
    locked,
    source,
    style: { fill: '#112233', stroke: '#445566', strokeWidth: 2, fillRule: 'evenodd' },
    transform,
    modifiers: [],
  };
}

function geometry(object: VectorObject) {
  return {
    id: object.id,
    name: object.name,
    layerId: object.layerId,
    visible: object.visible,
    locked: object.locked,
    style: object.style,
    transform: object.transform,
    source: object.source,
  };
}

function positions(source: SourcePath): Vec2[][] {
  return source.subpaths.map((subpath) => subpath.anchors.map((anchor) => anchor.position));
}

function handles(source: SourcePath) {
  return source.subpaths[0]?.anchors.map((anchor) => ({
    position: anchor.position,
    handleIn: anchor.handleIn,
    handleOut: anchor.handleOut,
  }));
}

function cubicAt(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

const empty: SourcePath = { subpaths: [] };
