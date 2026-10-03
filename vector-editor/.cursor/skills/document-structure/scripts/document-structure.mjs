#!/usr/bin/env node
// Cached map of layers, objects, selection, and the outliner in vector-editor.
// Usage (from vector-editor/):
//   node .cursor/skills/document-structure/scripts/document-structure.mjs           print the cache
//   node .cursor/skills/document-structure/scripts/document-structure.mjs --check   verify every cached symbol still exists
//   node .cursor/skills/document-structure/scripts/document-structure.mjs --json    print the cache as JSON

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  model: {
    layer: 'id, name, visible, locked, order',
    object: "id, name, layerId, visible, locked, kind 'path' | 'empty', source, style, transform, modifiers",
    depth: 'lower Layer.order is farther back; objects array order is back to front inside a layer',
    outliner: 'layersFrontToBack, then objectsOnLayer reversed',
    newDocument: 'one Layer at order 0 and one closed Path; selected layer is the front layer',
  },
  selection: {
    fields: 'activeObjectId, selectedObjectIds, editSelectionKind, selectedAnchorIds, selectedSegmentIds',
    objectClick: "replace; Shift is add",
    layerClick: 'session.selectLayer; not a history step',
    objectSelect: "session.select is history label Select",
    afterDelete: 'drop removed ids; active falls back to the last remaining selected id',
    afterLayerDelete: 'selectedLayerId falls back to the front layer',
    editMode: 'empty points leave the object selection and the outliner',
  },
  operations: {
    addLayer: 'max(order) + 1, name Layer / Layer 2, becomes selectedLayerId',
    reorder: 'reorderLayer(id, index) uses the front-to-back visual index; 0 is the front',
    updateLayer: 'trimmed name, visible, locked; an empty patch returns the same document',
    addPath: 'null when the layer is missing, locked, or hidden; selects the new path',
    duplicate: 'append "<name> copy", DUPLICATE_OFFSET 24, select the copies',
    deleteObjects: 'skip locked objects and objects on a locked layer',
    deleteLayer: 'refuse a locked layer; remove every object on it, including locked children',
    booleans: 'drop a boolean modifier whose operand was removed',
    lock: 'isInteractionLocked when the object or its layer is locked',
    hide: 'stays selectable; objectsInPaintOrder omits a hidden object or a hidden layer',
  },
  shortcuts: {
    duplicate: 'Shift+D -> object.duplicate',
    hide: 'H -> object.setFlags visible toggled for the selection',
    delete: 'Delete on the viewport in object mode -> object.delete; X deletes anchors in edit mode',
  },
  files: [
    { path: 'src/app/core/model/types.ts', role: 'Document, Layer, VectorObject', symbols: ['export interface Layer', 'export interface VectorObject', 'export interface Document', "readonly kind?: 'path' | 'empty'"] },
    { path: 'src/app/core/model/paint-order.ts', role: 'order and lock', symbols: ['layersBackToFront', 'layersFrontToBack', 'objectsOnLayer', 'isInteractionLocked', 'objectsInPaintOrder'] },
    { path: 'src/app/core/model/paint-order.spec.ts', role: 'paint-order tests', symbols: ['omits a hidden object', 'is locked by the object or by its layer'] },
    { path: 'src/app/core/model/delete-objects.ts', role: 'delete objects and layers', symbols: ['deletableObjectIds', 'deleteLayer', 'deleteObjects', 'withoutDeletedOperands'] },
    { path: 'src/app/core/model/delete-objects.spec.ts', role: 'delete tests', symbols: ['leaves locked objects', 'removes the layer, including locked children'] },
    { path: 'src/app/core/model/duplicate-objects.ts', role: 'duplicate', symbols: ['DUPLICATE_OFFSET', 'duplicateObjects', '${object.name} copy'] },
    { path: 'src/app/core/model/duplicate-objects.spec.ts', role: 'duplicate tests', symbols: ['points a copied boolean at the copied operand'] },
    { path: 'src/app/core/model/document-edits.ts', role: 'add, update, reorder, add path', symbols: ['addLayer', 'updateLayer', 'reorderLayer', 'addPath', 'nextSeriesName'] },
    { path: 'src/app/core/model/document-edits.spec.ts', role: 'layer edit tests', symbols: ['adds, renames, and reorders layers from front to back'] },
    { path: 'src/app/core/model/create-document.ts', role: 'new document', symbols: ['createNewDocument', 'defaultDocumentWidth', 'defaultDocumentHeight', "name: 'Layer'"] },
    { path: 'src/app/core/model/empty-point.ts', role: 'empty-point kind', symbols: ['isEmptyPoint', 'addEmptyPoint'] },
    { path: 'src/app/core/session.service.ts', role: 'selection and structure commands', symbols: ['applySelect', 'applySelectLayer', 'applyDelete', 'applyDeleteLayer', 'applyDuplicate', 'applyAddLayer', 'withoutRemovedObjects', 'reconcileSelectedLayer', 'withoutEmptySelection'] },
    { path: 'src/app/panels/outliner/components/outliner-panel/outliner-panel.ts', role: 'outliner tree', symbols: ['OutlinerPanel', 'focusableRows', 'deletableObjectIds', 'layersFrontToBack', 'data-tree-key'] },
    { path: 'src/app/panels/outliner/components/outliner-panel/outliner-panel.html', role: 'tree rows', symbols: ['data-tree-key', 'aria-expanded'] },
    { path: 'src/app/panels/outliner/components/outliner-panel/outliner-panel.spec.ts', role: 'outliner tests', symbols: ['selects the object from its row', 'deletes the selected layer'] },
    { path: 'src/app/panels/outliner/models/outliner-layer.model.ts', role: 'outliner view model', symbols: ['export interface OutlinerLayer', 'canMoveForward'] },
    { path: 'src/app/keymap/services/keymap.service.ts', role: 'duplicate, hide, delete', symbols: ["type: 'object.duplicate'", 'toggleVisible', 'deletableObjectIds'] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/core/model/paint-order.spec.ts --include=src/app/core/model/delete-objects.spec.ts --include=src/app/core/model/duplicate-objects.spec.ts --include=src/app/core/model/document-edits.spec.ts --include=src/app/core/model/create-document.spec.ts --include=src/app/panels/outliner/components/outliner-panel/outliner-panel.spec.ts',
  gotchas: [
    'reorderLayer index is the front-to-back visual index. It is not the stored order field.',
    'A new layer is painted in front because its order is max(order) + 1.',
    'Hidden objects stay in the outliner. objectsInPaintOrder omits a hidden object and a hidden layer.',
    'deleteObjects skips locked objects. deleteLayer removes locked children of an unlocked layer.',
    'Edit mode filters empty points out of the outliner and out of the object selection.',
    'session.selectLayer is not an undo step. session.select is.',
    'Keyboard Delete removes objects only in object mode while the viewport is focused. The outliner delete button does not need that focus.',
  ],
};

function check() {
  let failures = 0;
  for (const file of cache.files) {
    const full = resolve(root, file.path);
    if (!existsSync(full)) {
      console.log(`MISSING FILE  ${file.path}`);
      failures += 1;
      continue;
    }
    const text = readFileSync(full, 'utf8');
    for (const symbol of file.symbols) {
      if (!text.includes(symbol)) {
        console.log(`STALE         ${file.path}: ${symbol}`);
        failures += 1;
      }
    }
  }
  console.log(
    failures === 0 ? 'Cache is fresh.' : `${failures} stale entries; update the cache in document-structure.mjs.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

function print() {
  console.log('Model:');
  for (const [key, value] of Object.entries(cache.model)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nSelection:');
  for (const [key, value] of Object.entries(cache.selection)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nOperations:');
  for (const [key, value] of Object.entries(cache.operations)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nShortcuts:');
  for (const [key, value] of Object.entries(cache.shortcuts)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nFiles:');
  for (const file of cache.files) {
    console.log(`  ${file.path}  (${file.role})`);
  }
  console.log(`\nTests: ${cache.tests}`);
  console.log('\nGotchas:');
  for (const item of cache.gotchas) {
    console.log(`  - ${item}`);
  }
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  check();
} else if (args.includes('--json')) {
  console.log(JSON.stringify(cache, null, 2));
} else {
  print();
}
