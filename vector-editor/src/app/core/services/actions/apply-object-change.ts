import { SessionSlice, VectorObject } from '@vector-editor/modules/types';
import { applyDocument, mapObjects } from './document-helpers';

export function applyObjectChange(state: SessionSlice, objectId: string, update: (object: VectorObject) => VectorObject): SessionSlice {
  return applyDocument(state, (document) => mapObjects(document, [objectId], update));
}
