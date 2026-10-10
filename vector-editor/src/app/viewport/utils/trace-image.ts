import { TRACE_SAMPLE_LIMIT, traceRaster, TraceSettings } from '@vector-editor/modules/image-trace';
import { ImageContent, TraceFault, TraceRegion } from '@vector-editor/modules/types';

export interface TraceImageResult {
  readonly regions: readonly TraceRegion[];
  readonly fault?: TraceFault;
}

export async function traceImageContent(image: ImageContent, settings: TraceSettings): Promise<TraceImageResult> {
  if (!image.dataUrl) {
    return { regions: [] };
  }
  const raster = await rasterizeFrame(image);
  if (!raster) {
    return { regions: [], fault: 'unread' };
  }
  return {
    regions: traceRaster({
      ...raster,
      ...settings,
      frameWidth: image.width,
      frameHeight: image.height,
    }),
  };
}

async function rasterizeFrame(image: ImageContent): Promise<{
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
} | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return null;
  }
  try {
    const blob = await (await fetch(image.dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const size = sampleSize(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      bitmap.close?.();
      return null;
    }
    context.clearRect(0, 0, size.width, size.height);
    if (image.preserveAspectRatio === 'none') {
      context.drawImage(bitmap, 0, 0, size.width, size.height);
    } else {
      const scale = Math.min(size.width / bitmap.width, size.height / bitmap.height);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      context.drawImage(bitmap, (size.width - width) / 2, (size.height - height) / 2, width, height);
    }
    const pixels = context.getImageData(0, 0, size.width, size.height).data;
    bitmap.close?.();
    return { width: size.width, height: size.height, rgba: pixels };
  } catch {
    return null;
  }
}

function sampleSize(width: number, height: number): { readonly width: number; readonly height: number } {
  const edge = Math.max(width, height);
  const scale = edge > TRACE_SAMPLE_LIMIT ? TRACE_SAMPLE_LIMIT / edge : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
