export { createId } from '../core/utils/create-id';
export { createNewDocument, defaultDocumentHeight, defaultDocumentWidth } from './create-document';
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
export { alignObjects, canAlignObjects, countAlignable } from './align-objects';
export type { AlignEdge, AlignTarget } from './align-objects';
export { addEmptyPoint, isEmptyPoint } from './empty-point';
export type { EmptyPointResult } from './empty-point';
export {
  addImage,
  imageExtension,
  imageObjectName,
  isImage,
  isImageDataUrl,
  isImageMime,
  safeImageFileName,
} from './image';
export type { ImageDraft, ImageObjectResult } from './image';
export { expandTrace } from './expand-trace';
export {
  TRACE_SAMPLE_LIMIT,
  clampTraceSettings,
  defaultTraceSettings,
  enabledTrace,
  imageTraceDiagnostics,
  tracePreview,
  tracePresets,
  traceRaster,
} from './image-trace';
export type { TracePreset, TraceRasterInput, TraceSettings } from './image-trace';
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
export { svgStrokeDefaults } from './types';
export { rotationOriginDocument, transformWithRotationOrigin } from './transform';
export type {
  Anchor,
  Document,
  Layer,
  Gradient,
  GradientStop,
  GradientType,
  ImageAspect,
  ImageContent,
  ImageMime,
  ImagePlacement,
  Modifier,
  TraceFault,
  TraceMode,
  TraceRegion,
  TraceView,
  ObjectTransform,
  Segment,
  SourcePath,
  StrokeAlign,
  StrokeLinecap,
  StrokeLinejoin,
  Style,
  Subpath,
  Swatch,
  Vec2,
  VectorObject,
  ViewBox,
  ViewportCamera,
} from './types';
