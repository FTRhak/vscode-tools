import { createNewDocument } from '@vector-editor/modules/create-document';
import {
  addSwatch,
  applySwatch,
  createGradient,
  deleteGradient,
  reorderLayer,
  setObjectStyle,
  updateGradient,
  updateLayer,
} from '@vector-editor/modules/document-edits';
import { setAnchorHandle, setAnchorPointType, setAnchorPosition, translateAnchors } from '@vector-editor/modules/edit-path';
import { addModifier, removeModifier, reorderModifier, updateModifier } from '@vector-editor/modules/modifier-edits';
import { SessionSlice } from '@vector-editor/modules/types';
import { emptySelection } from '@vector-editor/commands';
import { DocumentCommand } from '../../models';
import { applyAnchorSelect } from './apply-anchor-select';
import { applyDeleteAnchors } from './apply-delete-anchors';
import { applyEditSelectionKind } from './apply-edit-selection-kind';
import { applyImagePlacement } from './apply-image-placement';
import { applyInsertPoint } from './apply-insert-point';
import { applyMode } from './apply-mode';
import { applySelect } from './apply-select';
import { applyTool } from './apply-tool';
import { applyDocument, defaultLayerId } from './document-helpers';
import {
  applyAddLayer,
  applyAddPath,
  applyAlign,
  applyBakedTransform,
  applyDelete,
  applyDeleteLayer,
  applyDuplicate,
  applyFlags,
  applyImageAdd,
  applyModifierCommand,
  applyObjectChange,
  applyPenAddPoint,
  applyPenBegin,
  applyPenFinish,
  applyPenSetHandles,
  applyPointAdd,
  applyRotationOrigin,
  applySelectLayer,
  applyShapeAdd,
  applyTransform,
  applyTranslate,
} from './object-actions';
import { replaceSource } from './replace-source';

export function applySessionCommand(state: SessionSlice, command: DocumentCommand): SessionSlice {
  switch (command.type) {
    case 'session.setMode':
      return applyMode(state, command.mode);
    case 'session.setTool':
      return applyTool(state, command.tool);
    case 'session.setImagePlacement':
      return applyImagePlacement(state, command.placement);
    case 'session.setEditSelectionKind':
      return applyEditSelectionKind(state, command.kind);
    case 'document.new': {
      const document = createNewDocument({ width: command.width, height: command.height });
      return new SessionSlice({
        ...state,
        document,
        selection: emptySelection,
        penObjectId: null,
        selectedLayerId: defaultLayerId(document),
      });
    }
    case 'document.replace':
      return new SessionSlice({
        ...state,
        document: command.document,
        mode: 'object',
        selection: emptySelection,
        penObjectId: null,
        selectedLayerId: defaultLayerId(command.document),
      });
    case 'session.setViewport':
      return new SessionSlice({
        ...state,
        viewport: { panX: command.panX, panY: command.panY, zoom: command.zoom },
      });
    case 'session.select':
      return command.target === 'anchor' ? applyAnchorSelect(state, command) : applySelect(state, command);
    case 'session.selectLayer':
      return applySelectLayer(state, command.id);
    case 'path.translateAnchors':
      return replaceSource(state, command.objectId, (source) => translateAnchors(source, command.anchorIds, command.dx, command.dy));
    case 'path.setAnchor':
      return replaceSource(state, command.objectId, (source) => setAnchorPosition(source, command.anchorIds, command.position));
    case 'path.setHandle':
      return replaceSource(state, command.objectId, (source) =>
        setAnchorHandle(source, command.anchorIds, command.slot, command.position, command.breakLink),
      );
    case 'path.setAnchorType':
      return replaceSource(state, command.objectId, (source) => setAnchorPointType(source, command.anchorIds, command.pointType));
    case 'path.deleteAnchors':
      return applyDeleteAnchors(state, command);
    case 'path.insertPoint':
      return applyInsertPoint(state, command);
    case 'object.translate':
      return applyTranslate(state, command);
    case 'object.setTransform':
      return applyTransform(state, command);
    case 'object.setRotationOrigin':
      return applyRotationOrigin(state, command);
    case 'object.applyTransform':
      return applyBakedTransform(state, command);
    case 'object.setFlags':
      return applyFlags(state, command);
    case 'object.duplicate':
      return applyDuplicate(state, command);
    case 'object.delete':
      return applyDelete(state, command);
    case 'object.align':
      return applyAlign(state, command);
    case 'style.set':
      return applyDocument(state, (document) =>
        setObjectStyle(document, command.objectIds, {
          fill: command.fill,
          stroke: command.stroke,
          strokeWidth: command.strokeWidth,
          strokeLinecap: command.strokeLinecap,
          strokeLinejoin: command.strokeLinejoin,
          strokeMiterlimit: command.strokeMiterlimit,
          strokeOpacity: command.strokeOpacity,
          strokeDashoffset: command.strokeDashoffset,
          strokeDasharray: command.strokeDasharray,
          strokeAlign: command.strokeAlign,
        }),
      );
    case 'gradient.create':
      return applyDocument(state, (document) => createGradient(document, command.gradient, command.target, command.objectIds));
    case 'gradient.update':
      return applyDocument(state, (document) => updateGradient(document, command.id, command.gradient));
    case 'gradient.delete':
      return applyDocument(state, (document) => deleteGradient(document, command.id));
    case 'swatch.add':
      return applyDocument(state, (document) => addSwatch(document, command.name, command.color));
    case 'swatch.apply':
      return applyDocument(state, (document) => applySwatch(document, command.swatchId, command.target, command.objectIds));
    case 'layer.add':
      return applyAddLayer(state);
    case 'path.add':
      return applyAddPath(state, command.layerId);
    case 'point.add':
      return applyPointAdd(state, command);
    case 'shape.add':
      return applyShapeAdd(state, command);
    case 'image.add':
      return applyImageAdd(state, command);
    case 'layer.update':
      return applyDocument(state, (document) => updateLayer(document, command.id, command));
    case 'layer.reorder':
      return applyDocument(state, (document) => reorderLayer(document, command.id, command.index));
    case 'layer.delete':
      return applyDeleteLayer(state, command);
    case 'pen.begin':
      return applyPenBegin(state, command);
    case 'pen.addPoint':
      return applyPenAddPoint(state, command);
    case 'pen.setHandles':
      return applyPenSetHandles(state, command);
    case 'pen.finish':
      return applyPenFinish(state, command);
    case 'modifier.add':
      return applyObjectChange(state, command.objectId, (object) =>
        addModifier(object, command.kind, state.document?.objects ?? [], command.trace),
      );
    case 'modifier.update':
      return applyObjectChange(state, command.objectId, (object) => updateModifier(object, command.modifierId, command.patch));
    case 'modifier.remove':
      return applyObjectChange(state, command.objectId, (object) => removeModifier(object, command.modifierId));
    case 'modifier.reorder':
      return applyObjectChange(state, command.objectId, (object) => reorderModifier(object, command.modifierId, command.index));
    case 'modifier.apply':
      return applyModifierCommand(state, command.objectId, command.modifierId);
    case 'modifier.applyAll':
      return applyModifierCommand(state, command.objectId);
    default:
      return state;
  }
}
