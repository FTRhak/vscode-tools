import type { Gradient } from './gradient.model';
import type { Layer } from './layer.model';
import type { Swatch } from './swatch.model';
import type { VectorObject } from './vector-object.model';
import type { ViewBox } from './view-box.model';

export interface Document {
  readonly id: string;
  readonly name: string;
  readonly viewBox: ViewBox;
  readonly layers: readonly Layer[];
  readonly objects: readonly VectorObject[];
  readonly swatches: readonly Swatch[];
  readonly gradients: readonly Gradient[];
}
