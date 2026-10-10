import { createNewDocument } from '../model/create-document';
import { setObjectStyle } from '../model/document-edits';
import { addEmptyPoint } from '../model/empty-point';
import { Document, SourcePath, svgStrokeDefaults, Vec2, VectorObject } from '../model/types';
import { parsePathData } from './path-data-parse';
import { addImage } from '../model/image';
import { traceRaster } from '../model/image-trace';
import { addModifier } from '../model/modifier-edits';
import { exportSvg as exportSvgResult, ImageLocation, SaveMode } from './svg-export';
import { importSvg } from './svg-import';

function exportSvg(document: Document, mode: SaveMode, images?: ImageLocation): string {
  return exportSvgResult(document, mode, images).svg;
}

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
      ...svgStrokeDefaults,
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

  it('reads stroke paint from attributes, style, and inheritance', () => {
    const result = importSvg(`
      <svg viewBox="0 0 20 20">
        <path d="M 0 0 L 10 0" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="2" stroke-opacity="50%" stroke-dasharray="4 1 2" stroke-dashoffset="-3"/>
        <path d="M 0 5 L 10 5" stroke-linejoin="arcs" stroke-miterlimit="0.5" stroke-dasharray="4%" stroke-dashoffset="10%"/>
        <path d="M 0 10 L 10 10" stroke-linecap="butt" style="stroke-linecap: square"/>
        <g stroke-linejoin="round">
          <path d="M 0 15 L 10 15"/>
        </g>
      </svg>
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const [painted, fallback, styled, inherited] = result.document.objects;
    expect(painted?.style).toMatchObject({
      strokeLinecap: 'round',
      strokeLinejoin: 'bevel',
      strokeMiterlimit: 2,
      strokeOpacity: 0.5,
      strokeDasharray: [4, 1, 2],
      strokeDashoffset: -3,
    });
    expect(fallback?.style).toMatchObject({
      strokeLinecap: 'butt',
      strokeLinejoin: 'miter',
      strokeMiterlimit: 4,
      strokeOpacity: 1,
      strokeDasharray: null,
      strokeDashoffset: 0,
    });
    expect(styled?.style.strokeLinecap).toBe('square');
    expect(inherited?.style.strokeLinejoin).toBe('round');
  });

  it('rejects a file that is not an svg document', () => {
    expect(importSvg('').ok).toBe(false);
    expect(importSvg('<html></html>').ok).toBe(false);
    expect(importSvg('<svg>').ok).toBe(false);
  });
});

describe('exportSvg', () => {
  it('round-trips stroke alignment in editor payloads and keeps the stroke width', () => {
    const document = createNewDocument();
    const id = document.objects[0]?.id ?? '';
    expect(exportSvg(document, 'all')).not.toContain('strokeAlign');
    const aligned = setObjectStyle(document, [id], { strokeAlign: 'inside' });
    const width = aligned.objects[0]?.style.strokeWidth ?? 0;

    for (const mode of ['all', 'optimized'] as const) {
      const svg = exportSvg(aligned, mode);
      expect(svg).toContain('&quot;strokeAlign&quot;:&quot;inside&quot;');
      expect(svg).toContain(`&quot;strokeWidth&quot;:${width}`);
      expect(svg).toContain('clip-path="url(#stroke-clip-0)"');
      expect(svg).toContain(`stroke-width="${width * 2}"`);
      expect(svg).not.toContain(`stroke-width="${width}"`);
      const result = importSvg(svg);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.document.objects).toHaveLength(1);
      expect(result.document.objects[0]?.style.strokeAlign).toBe('inside');
      expect(result.document.objects[0]?.style.strokeWidth).toBe(width);
    }

    const outside = setObjectStyle(document, [id], { strokeAlign: 'outside' });
    const outsideSvg = exportSvg(outside, 'all');
    expect(outsideSvg).toContain('<use href="#stroke-paint-0"/>');
    expect(outsideSvg).toContain('stroke="none"');
    const outsideResult = importSvg(outsideSvg);
    expect(outsideResult.ok).toBe(true);
    if (!outsideResult.ok) {
      return;
    }
    expect(outsideResult.document.objects).toHaveLength(1);
    expect(outsideResult.document.objects[0]?.style).toMatchObject({
      strokeAlign: 'outside',
      strokeWidth: width,
      stroke: outside.objects[0]?.style.stroke,
    });

    const open = {
      ...aligned,
      objects: aligned.objects.map((object) => ({
        ...object,
        source: {
          subpaths: object.source.subpaths.map((subpath) => ({ ...subpath, closed: false })),
        },
      })),
    };
    const openSvg = exportSvg(open, 'all');
    expect(openSvg).not.toContain('clip-path');
    expect(openSvg).toContain(`stroke-width="${width}"`);
    expect(openSvg).not.toContain(`stroke-width="${width * 2}"`);

    const minimal = exportSvg(aligned, 'minimal');
    expect(minimal).not.toContain('strokeAlign');
    expect(minimal).toContain('clip-path="url(#stroke-clip-0)"');
    expect(minimal).toContain(`stroke-width="${width * 2}"`);
    const imported = importSvg(minimal);
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      return;
    }
    expect(imported.document.objects[0]?.style.strokeAlign).toBe('default');
    expect(imported.document.objects[0]?.style.strokeWidth).toBe(width * 2);

    const foreign = importSvg('<svg viewBox="0 0 10 10"><path d="M 0 0 L 10 0 L 10 10 Z"/></svg>');
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) {
      return;
    }
    expect(foreign.document.objects[0]?.style.strokeAlign).toBe('default');

    const tampered = exportSvg(aligned, 'all').replace(
      '&quot;strokeAlign&quot;:&quot;inside&quot;',
      '&quot;strokeAlign&quot;:&quot;center&quot;',
    );
    const rejected = importSvg(tampered);
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) {
      return;
    }
    expect(rejected.document.objects[0]?.style.strokeAlign).toBe('default');
  });

  it('round-trips stroke paint in every save mode', () => {
    const document = createNewDocument();
    const id = document.objects[0]?.id ?? '';
    const painted = setObjectStyle(document, [id], {
      strokeLinecap: 'round',
      strokeLinejoin: 'bevel',
      strokeMiterlimit: 2,
      strokeOpacity: 0.5,
      strokeDasharray: [4, 1, 2],
      strokeDashoffset: -3,
    });

    for (const mode of ['all', 'optimized', 'minimal'] as const) {
      const result = importSvg(exportSvg(painted, mode));
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.document.objects[0]?.style).toMatchObject({
        strokeLinecap: 'round',
        strokeLinejoin: 'bevel',
        strokeMiterlimit: 2,
        strokeOpacity: 0.5,
        strokeDasharray: [4, 1, 2],
        strokeDashoffset: -3,
      });
    }
  });

  it('round-trips mirror empty-point references in all and optimized modes', () => {
    const base = sampleDocument();
    const pointResult = addEmptyPoint(base, { x: 24, y: 18 }, base.layers[0]?.id);
    expect(pointResult).not.toBeNull();
    if (!pointResult) {
      return;
    }
    const point = pointResult.document.objects.at(-1);
    const owner = pointResult.document.objects[0];
    if (!point || !owner) {
      throw new Error('Mirror reference objects are missing');
    }
    const document: Document = {
      ...pointResult.document,
      objects: pointResult.document.objects.map((object) =>
        object.id === owner.id
          ? {
              ...object,
              modifiers: [
                {
                  id: 'mirror-1',
                  type: 'mirror',
                  axis: 'xy',
                  centerPointId: point.id,
                  enabled: true,
                },
                { id: 'mirror-none', type: 'mirror', axis: 'none', enabled: true },
              ],
            }
          : object,
      ),
    };

    const allResult = importSvg(exportSvg(document, 'all'));
    expect(allResult.ok).toBe(true);
    if (!allResult.ok) {
      return;
    }
    expect(allResult.document.objects[0]?.modifiers[0]).toMatchObject({
      type: 'mirror',
      centerPointId: point.id,
    });
    expect(allResult.document.objects[0]?.modifiers[1]).toMatchObject({
      type: 'mirror',
      axis: 'none',
    });

    const optimized = exportSvg(document, 'optimized');
    expect(optimized).toContain('centerPointIndex&quot;:1');
    const optimizedResult = importSvg(optimized);
    expect(optimizedResult.ok).toBe(true);
    if (!optimizedResult.ok) {
      return;
    }
    expect(optimizedResult.document.objects[0]?.modifiers[0]).toMatchObject({
      type: 'mirror',
      centerPointId: optimizedResult.document.objects[1]?.id,
    });
  });

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
          data-vector-editor='{"version":1,"name":"Path","source":{"subpaths":[{"closed":false,"anchors":[{"id":"a","position":{"x":0,"y":0},"handleIn":null,"handleOut":null},{"id":"b","position":{"x":1,"y":0},"handleIn":null,"handleOut":null}],"segments":[{"id":"s","kind":"line","fromId":"a","toId":"b"}]}]},"transform":{"x":3,"y":0,"rotation":0,"scaleX":1,"scaleY":1},"modifiers":[{"id":"arr-1","type":"array","count":4.8,"offsetX":2,"offsetY":3,"enabled":false},{"id":"mir-1","type":"mirror","axis":"y"},{"id":"mir-none","type":"mirror","axis":"none"},{"id":"round-1","type":"round","mode":"circle","anchorCount":8,"roundness":75},{"id":"round-2","type":"round","anchorCount":4,"roundness":50},{"type":"bevel","distance":1},{"type":"boolean","operation":"union","operandId":"missing"},{"type":"array"}],"locked":true}' />
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
      { id: 'mir-none', type: 'mirror', axis: 'none', enabled: true },
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

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('image svg', () => {
  it('round-trips embed, link, and preserve without fetching external urls', () => {
    const document = createNewDocument();
    const embedded = addImage(
      document,
      {
        name: 'Photo',
        placement: 'embed',
        fileName: 'photo.png',
        mime: 'image/png',
        dataUrl: pixel,
        pixelWidth: 1,
        pixelHeight: 1,
        x: 4,
        y: 6,
        width: 20,
        height: 10,
        preserveAspectRatio: 'none',
      },
      document.layers[0].id,
    );
    expect(embedded).not.toBeNull();
    const linked = addImage(
      embedded!.document,
      {
        name: 'Scan',
        placement: 'link',
        fileName: 'scan.png',
        mime: 'image/png',
        dataUrl: pixel,
        pixelWidth: 1,
        pixelHeight: 1,
        x: 30,
        y: 8,
        width: 12,
        height: 12,
        preserveAspectRatio: 'xMidYMid meet',
      },
      document.layers[0].id,
    );
    expect(linked).not.toBeNull();
    const current = linked!.document;

    for (const mode of ['all', 'optimized', 'minimal'] as const) {
      const preserved = exportSvgResult(current, mode, 'preserve');
      expect(preserved.svg).toContain(`href="${pixel}"`);
      expect(preserved.svg).toContain('xlink:href="scan.png"');
      expect(preserved.files.map((file) => file.name)).toEqual(['scan.png']);
      const embed = exportSvgResult(current, mode, 'embed');
      expect(embed.svg).not.toContain('href="scan.png"');
      expect(embed.svg).not.toContain('href="photo.png"');
      expect(embed.files).toEqual([]);
      const link = exportSvgResult(current, mode, 'link');
      expect(link.svg).not.toContain(`href="${pixel}"`);
      expect(link.svg).toContain('href="photo.png"');
      expect(link.files.map((file) => file.name)).toEqual(['photo.png', 'scan.png']);

      if (mode === 'minimal') {
        const opened = importSvg(embed.svg);
        expect(opened.ok).toBe(true);
        if (opened.ok) {
          expect(opened.document.objects.filter((object) => object.kind === 'image')).toHaveLength(2);
          expect(opened.document.objects.some((object) => object.image?.dataUrl === pixel)).toBe(true);
        }
        continue;
      }
      const opened = importSvg(preserved.svg);
      expect(opened.ok).toBe(true);
      if (!opened.ok) {
        return;
      }
      const images = opened.document.objects.filter((object) => object.kind === 'image');
      expect(images.map((object) => object.image?.placement)).toEqual(['embed', 'link']);
      expect(images.every((object) => object.image?.dataUrl === pixel)).toBe(true);
      expect(images[0]?.transform).toMatchObject({ x: 4, y: 6 });
      expect(images[0]?.image).toMatchObject({ width: 20, height: 10, preserveAspectRatio: 'none' });
    }
  });

  it('keeps a live image trace in all and optimized and bakes minimal paths', () => {
    const width = 8;
    const height = 4;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        rgba[offset] = x < 4 ? 255 : 0;
        rgba[offset + 2] = x < 4 ? 0 : 255;
        rgba[offset + 3] = 255;
      }
    }
    const regions = traceRaster({
      width,
      height,
      rgba,
      frameWidth: width,
      frameHeight: height,
      mode: 'color',
      colors: 8,
      threshold: 128,
      paths: 100,
      corners: 100,
      noise: 0,
      ignoreWhite: false,
    });
    const document = createNewDocument();
    const added = addImage(
      document,
      {
        name: 'Photo',
        placement: 'embed',
        fileName: 'photo.png',
        mime: 'image/png',
        dataUrl: pixel,
        pixelWidth: width,
        pixelHeight: height,
        x: 4,
        y: 6,
        width,
        height,
        preserveAspectRatio: 'none',
      },
      document.layers[0].id,
    );
    expect(added).not.toBeNull();
    const traced = {
      ...added!.document,
      objects: added!.document.objects.map((object) => {
        if (object.id !== added!.objectId) {
          return object;
        }
        const tracedObject = addModifier(object, 'trace', added!.document.objects, { regions });
        return {
          ...tracedObject,
          modifiers: tracedObject.modifiers.map((modifier) =>
            modifier.type === 'trace' ? { ...modifier, mode: 'colorDistance' as const } : modifier,
          ),
        };
      }),
    };

    const all = importSvg(exportSvg(traced, 'all'));
    expect(exportSvg(traced, 'all')).toContain('<g ');
    expect(exportSvg(traced, 'all')).toContain('fill="#ff0000"');
    expect(exportSvg(traced, 'all')).not.toContain('<image ');
    expect(all.ok).toBe(true);
    if (!all.ok) {
      return;
    }
    const allImage = all.document.objects.find((object) => object.kind === 'image');
    expect(allImage?.image?.dataUrl).toBe(pixel);
    expect(allImage?.transform).toMatchObject({ x: 4, y: 6 });
    expect(allImage?.modifiers[0]).toMatchObject({ type: 'trace', mode: 'colorDistance', colors: 16 });
    expect(allImage?.modifiers[0]?.type === 'trace' ? allImage.modifiers[0].regions : []).toHaveLength(2);

    const optimized = importSvg(exportSvg(traced, 'optimized'));
    expect(optimized.ok).toBe(true);
    if (!optimized.ok) {
      return;
    }
    const optimizedImage = optimized.document.objects.find((object) => object.kind === 'image');
    expect(optimizedImage?.modifiers).toHaveLength(1);
    expect(optimizedImage?.modifiers[0]).toMatchObject({
      type: 'trace',
      mode: 'colorDistance',
      view: 'result',
    });
    expect(optimizedImage?.modifiers[0]?.type === 'trace' ? optimizedImage.modifiers[0].regions : []).toHaveLength(2);
    expect(optimizedImage?.image?.dataUrl).toBe(pixel);

    const minimalSvg = exportSvg(traced, 'minimal');
    expect(minimalSvg).toContain('fill="#0000ff"');
    expect(minimalSvg).not.toContain('data-vector-editor');
    expect(minimalSvg).not.toContain('<image ');
    const minimal = importSvg(minimalSvg);
    expect(minimal.ok).toBe(true);
    if (!minimal.ok) {
      return;
    }
    expect(minimal.document.objects.some((object) => object.kind === 'image')).toBe(false);
    const fills = minimal.document.objects.map((object) => object.style.fill);
    expect(fills).toContain('#ff0000');
    expect(fills).toContain('#0000ff');
  });

  it('reads a foreign image and skips remote and skewed references', () => {
    const foreign = importSvg(`
      <svg viewBox="0 0 100 100">
        <image href="${pixel}" x="2" y="3" width="8" height="5" preserveAspectRatio="none"/>
        <image href="https://example.test/a.png" x="0" y="0" width="4" height="4"/>
        <image href="photo.png" x="1" y="1" width="6" height="6" transform="skewX(20)"/>
        <image href="../secret.png" x="1" y="1" width="6" height="6"/>
      </svg>
    `);
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) {
      return;
    }
    expect(foreign.skipped).toBe(3);
    expect(foreign.document.objects).toHaveLength(1);
    expect(foreign.document.objects[0]?.image).toMatchObject({
      placement: 'embed',
      dataUrl: pixel,
      width: 8,
      height: 5,
      preserveAspectRatio: 'none',
    });
    expect(foreign.document.objects[0]?.transform).toMatchObject({ x: 2, y: 3, scaleX: 1, scaleY: 1 });
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
    style: {
      ...svgStrokeDefaults,
      fill: '#112233',
      stroke: '#445566',
      strokeWidth: 2,
      fillRule: 'evenodd',
    },
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
