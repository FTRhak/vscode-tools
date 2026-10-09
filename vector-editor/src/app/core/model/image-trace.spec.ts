import { traceRaster, TraceRasterInput } from './image-trace';
import { TraceRegion } from './types';

const settings: Omit<TraceRasterInput, 'width' | 'height' | 'rgba' | 'frameWidth' | 'frameHeight'> = {
  mode: 'color',
  colors: 8,
  threshold: 128,
  paths: 100,
  corners: 100,
  noise: 0,
  ignoreWhite: false,
};

describe('traceRaster', () => {
  it('separates two solid colors into closed regions', () => {
    const regions = traceRaster(raster(8, 4, (x) => (x < 4 ? [255, 0, 0] : [0, 0, 255])));
    expect(regions.map((region) => region.fill).sort()).toEqual(['#0000ff', '#ff0000']);
    for (const region of regions) {
      expect(region.source.subpaths).toHaveLength(1);
      expect(region.source.subpaths[0]?.closed).toBe(true);
      expect(region.source.subpaths[0]?.segments.every((segment) => segment.kind === 'line')).toBe(true);
    }
    const red = regions.find((region) => region.fill === '#ff0000');
    const blue = regions.find((region) => region.fill === '#0000ff');
    expect(bounds(red).maxX).toBeCloseTo(4);
    expect(bounds(red).minX).toBeCloseTo(0);
    expect(bounds(blue).minX).toBeCloseTo(4);
    expect(bounds(blue).maxX).toBeCloseTo(8);
  });

  it('keeps a hole as a second subpath so evenodd fill can open it', () => {
    const regions = traceRaster(
      raster(8, 8, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? [0, 0, 255] : [255, 0, 0])),
    );
    const red = regions.find((region) => region.fill === '#ff0000');
    const blue = regions.find((region) => region.fill === '#0000ff');
    expect(red?.source.subpaths).toHaveLength(2);
    expect(red?.source.subpaths.every((subpath) => subpath.closed)).toBe(true);
    expect(blue?.source.subpaths).toHaveLength(1);
    const areas = red?.source.subpaths.map((subpath) => boxArea(boundsOf(subpath.anchors.map((anchor) => anchor.position)))) ?? [];
    expect(Math.max(...areas)).toBeGreaterThan(Math.min(...areas));
  });

  it('drops a speckle smaller than noise and keeps the surrounding color', () => {
    const regions = traceRaster({
      ...raster(8, 8, (x, y) => (x === 4 && y === 4 ? [0, 0, 255] : [255, 0, 0])),
      noise: 2,
    });
    expect(regions.map((region) => region.fill)).toEqual(['#ff0000']);
    expect(regions[0]?.source.subpaths).toHaveLength(1);
  });

  it('omits near-white when ignore white is on', () => {
    const regions = traceRaster({
      ...raster(8, 8, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? [255, 0, 0] : [255, 255, 255])),
      ignoreWhite: true,
    });
    expect(regions.map((region) => region.fill)).toEqual(['#ff0000']);
  });

  it('uses the black and white threshold', () => {
    const image = raster(8, 4, (x) => (x < 4 ? [0, 0, 0] : [200, 200, 200]));
    const split = traceRaster({ ...image, mode: 'blackAndWhite', threshold: 128 });
    expect(split.map((region) => region.fill).sort()).toEqual(['#000000', '#ffffff']);
    const solid = traceRaster({ ...image, mode: 'blackAndWhite', threshold: 250 });
    expect(solid.map((region) => region.fill)).toEqual(['#000000']);
  });
});

function raster(
  width: number,
  height: number,
  paint: (x: number, y: number) => readonly [number, number, number],
): TraceRasterInput {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = paint(x, y);
      const offset = (y * width + x) * 4;
      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = 255;
    }
  }
  return { ...settings, width, height, rgba, frameWidth: width, frameHeight: height };
}

function bounds(region: TraceRegion | undefined): { minX: number; maxX: number; minY: number; maxY: number } {
  return boundsOf(region?.source.subpaths.flatMap((subpath) => subpath.anchors.map((anchor) => anchor.position)) ?? []);
}

function boundsOf(points: readonly { x: number; y: number }[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      maxX: Math.max(box.maxX, point.x),
      minY: Math.min(box.minY, point.y),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function boxArea(box: { minX: number; maxX: number; minY: number; maxY: number }): number {
  return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
}
