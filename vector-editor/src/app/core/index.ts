export {
  addLayer,
  addSwatch,
  applySwatch,
  createId,
  createNewDocument,
  DUPLICATE_OFFSET,
  deleteAnchors,
  duplicateObjects,
  isInteractionLocked,
  layersFrontToBack,
  nextSeriesName,
  objectsInPaintOrder,
  objectsOnLayer,
  reorderLayer,
  setAnchorHandle,
  setAnchorPosition,
  setObjectStyle,
  sourceToPathData,
  translateAnchors,
  updateLayer,
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
export { captureClipperHold, evaluateDocument, evaluateObject } from './eval/evaluate';
export type { ClipperHold, EvaluatedGeometry } from './eval/evaluate';
export { exportSvg, importSvg } from './io';
export type { SaveMode, SvgImportResult } from './io';
export { SessionService } from './session.service';
export type { SessionSlice } from './session.service';
