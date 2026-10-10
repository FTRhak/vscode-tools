import type { ImageContent } from './image-content.model';
import type { Modifier } from './modifier.model';
import type { ObjectTransform } from './object-transform.model';
import type { SourcePath } from './source-path.model';
import type { Style } from './style.model';

export interface VectorObject {
  readonly id: string;
  readonly name: string;
  readonly layerId: string;
  readonly visible: boolean;
  readonly locked: boolean;
  /** Missing kind is a path. Empty points are reference markers. Images are raster frames. */
  readonly kind?: 'path' | 'empty' | 'image';
  readonly source: SourcePath;
  readonly image?: ImageContent;
  readonly style: Style;
  readonly transform: ObjectTransform;
  readonly modifiers: readonly Modifier[];
}
