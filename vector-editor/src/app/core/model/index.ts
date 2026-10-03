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
  createGradient,
  nextSeriesName,
  reorderLayer,
  setObjectStyle,
  updateLayer,
} from './document-edits';
export { deleteLayer, deleteObjects, deletableObjectIds } from './delete-objects';
export { addEmptyPoint, isEmptyPoint } from './empty-point';
export type { EmptyPointResult } from './empty-point';
export {
  addShape,
  clampShapeCount,
  ELLIPSE_KAPPA,
  isShapeKind,
  shapeSource,
  shapeSourceFromDrag,
  SHAPE_NAMES,
} from './shapes';
export type { ShapeDrag, ShapeKind, ShapeObjectResult, ShapePlacement } from './shapes';
export { duplicateObjects, DUPLICATE_OFFSET } from './duplicate-objects';
export {
  deleteAnchors,
  INSERT_POINT_MARGIN,
  insertPoint,
  anchorPointType,
  setAnchorHandle,
  setAnchorPointType,
  setAnchorPosition,
  translateAnchors,
} from './edit-path';
export type { AnchorPointType } from './edit-path';
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
  Gradient,
  GradientStop,
  GradientType,
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
