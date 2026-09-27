export { createId } from './create-id';
export { createNewDocument } from './create-document';
export { duplicateObjects, DUPLICATE_OFFSET } from './duplicate-objects';
export { deleteAnchors, setAnchorHandle, setAnchorPosition, translateAnchors } from './edit-path';
export { layersFrontToBack, objectsInPaintOrder, objectsOnLayer } from './paint-order';
export { sourceToPathData } from './path-data';
export type {
  Anchor,
  Document,
  Layer,
  Modifier,
  ObjectTransform,
  Segment,
  SourcePath,
  Style,
  Subpath,
  Swatch,
  Vec2,
  VectorObject,
  ViewBox,
  ViewportCamera,
} from './types';
