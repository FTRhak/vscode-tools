import { fitArtboard, MAX_ZOOM, panBy, screenToDocument, zoomAtPoint } from './camera';

describe('camera', () => {
  it('fits the artboard inside the view with padding', () => {
    const camera = fitArtboard({ width: 1248, height: 848 }, { x: 0, y: 0, width: 1200, height: 800 }, 24);

    expect(camera.zoom).toBe(1);
    expect(camera.panX).toBe(24);
    expect(camera.panY).toBe(24);
  });

  it('keeps the document point under the cursor while zooming', () => {
    const start = { panX: 10, panY: 20, zoom: 2 };
    const cursor = { x: 110, y: 220 };
    const next = zoomAtPoint(start, cursor, 2);

    expect(next.zoom).toBe(4);
    expect((cursor.x - next.panX) / next.zoom).toBe((cursor.x - start.panX) / start.zoom);
    expect((cursor.y - next.panY) / next.zoom).toBe((cursor.y - start.panY) / start.zoom);
  });

  it('clamps zoom and still holds the cursor point', () => {
    const start = { panX: 0, panY: 0, zoom: MAX_ZOOM };
    const cursor = { x: 40, y: 80 };
    const next = zoomAtPoint(start, cursor, 2);

    expect(next.zoom).toBe(MAX_ZOOM);
    expect((cursor.x - next.panX) / next.zoom).toBe(cursor.x / start.zoom);
    expect((cursor.y - next.panY) / next.zoom).toBe(cursor.y / start.zoom);
  });

  it('pans in screen pixels without changing zoom', () => {
    expect(panBy({ panX: 1, panY: 2, zoom: 3 }, 4, 5)).toEqual({
      panX: 5,
      panY: 7,
      zoom: 3,
    });
  });

  it('maps a screen point back to the document', () => {
    expect(screenToDocument({ panX: 24, panY: 10, zoom: 2 }, { x: 64, y: 30 })).toEqual({
      x: 20,
      y: 10,
    });
  });
});
