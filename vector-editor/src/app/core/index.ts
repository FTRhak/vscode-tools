export {
  createId,
  createNewDocument,
  DUPLICATE_OFFSET,
  deleteAnchors,
  duplicateObjects,
  setAnchorHandle,
  setAnchorPosition,
  translateAnchors,
  layersFrontToBack,
  objectsInPaintOrder,
  objectsOnLayer,
  sourceToPathData,
} from './model';
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
} from './model';
export { SessionService } from './session.service';
export type { SessionSlice } from './session.service';
