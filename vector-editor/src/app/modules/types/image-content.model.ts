import type { ImageAspect } from './image-aspect.model';
import type { ImageMime } from './image-mime.model';
import type { ImagePlacement } from './image-placement.model';

export interface ImageContent {
  readonly placement: ImagePlacement;
  readonly fileName: string;
  readonly mime: ImageMime;
  readonly dataUrl: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly width: number;
  readonly height: number;
  readonly preserveAspectRatio: ImageAspect;
}
