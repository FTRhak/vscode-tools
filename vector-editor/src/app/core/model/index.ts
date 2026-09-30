export { createId } from './create-id';
export {
  createNewDocument,
  defaultDocumentHeight,
  defaultDocumentWidth,
} from './create-document';
export type { DocumentSize } from './create-document';
export {
  addLayer,
  addPath,
  addSwatch,
  applySwatch,
  nextSeriesName,
  reorderLayer,
  setObjectStyle,
  updateLayer,
} from './document-edits';
export { duplicateObjects, DUPLICATE_OFFSET } from './duplicate-objects';
export { deleteAnchors, setAnchorHandle, setAnchorPosition, translateAnchors } from './edit-path';
export {
  isInteractionLocked,
  layersFrontToBack,
  objectsInPaintOrder,
  objectsOnLayer,
} from './paint-order';
export { sourceToPathData } from './path-data';
export { rotationOriginDocument, transformWithRotationOrigin } from './transform';
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
