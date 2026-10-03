#!/usr/bin/env node
// Cached map of path editing in vector-editor: pen, direct select, and add point.
// Usage (from vector-editor/):
//   node .cursor/skills/path-editing/scripts/path-editing.mjs           print the cache
//   node .cursor/skills/path-editing/scripts/path-editing.mjs --check   verify every cached symbol still exists
//   node .cursor/skills/path-editing/scripts/path-editing.mjs --json    print the cache as JSON

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  tools: {
    pen: { shortcut: 'P', mode: 'object starts a stroke; edit continues an open path' },
    directSelect: { shortcut: 'A', mode: 'edit only; does not enter edit mode' },
    addPoint: { shortcut: '+ or =', mode: 'edit only, active path' },
  },
  model: {
    objectKind: "'path' with one open subpath until pen.finish closes it",
    penStyle: { fill: null, stroke: '#1a1a1a', strokeWidth: 4, fillRule: 'nonzero' },
    naming: 'Path, Path 2, ... on the selected layer',
    pointTypes: ['corner', 'smooth', 'symmetric', 'line'],
    handles: 'moving an anchor shifts both handles by the same delta',
    insert: 'path.insertPoint rejects t within INSERT_POINT_MARGIN of 0 or 1',
  },
  commands: {
    'pen.begin': 'Pen',
    'pen.addPoint': 'Pen',
    'pen.setHandles': 'Pen; gesture continue joins the open Pen entry',
    'pen.finish': "Close path when closed; null when the stroke stays open",
    'path.translateAnchors': 'Move anchors; gesture continue coalesces',
    'path.setHandle': "Move handle when gesture is set, otherwise Set handle",
    'path.setAnchor': 'Set anchor',
    'path.setAnchorType': 'Set point type',
    'path.insertPoint': 'Add point',
    'path.deleteAnchors': 'Delete anchors',
  },
  gestures: {
    threshold: 'PEN_DRAG_THRESHOLD_PX and DIRECT_SELECT_THRESHOLD_PX are 4',
    penClose: 'click the first anchor when the open subpath has at least two anchors',
    penAlt: 'breakLink leaves handleIn null',
    directAlt: 'dragging a handle with Alt keeps the opposite handle',
    directShift: 'adds the clicked anchor; a marquee adds instead of replacing',
    addPoint: 'one click, ADD_POINT_HIT_PX = 8, no clipper hold',
    keys: 'Enter finishes open; Escape undoes; 1/2 set anchor or segment; Delete/X deletes anchors',
  },
  files: [
    { path: 'src/app/core/model/pen-path.ts', role: 'pen geometry', symbols: ['beginPenObject', 'addPenPoint', 'setPenHandles', 'finishPen', 'penStyle'] },
    { path: 'src/app/core/model/pen-path.spec.ts', role: 'pen model tests', symbols: ['starts an open object on the back layer'] },
    { path: 'src/app/core/model/edit-path.ts', role: 'anchor, handle, insert, delete', symbols: ['translateAnchors', 'setAnchorPosition', 'setAnchorHandle', 'setAnchorPointType', 'anchorPointType', 'insertPoint', 'deleteAnchors', 'INSERT_POINT_MARGIN'] },
    { path: 'src/app/core/model/edit-path.spec.ts', role: 'edit-path tests', symbols: ['moves an anchor together with both handles'] },
    { path: 'src/app/core/model/index.ts', role: 'edit-path barrel only', symbols: ['deleteAnchors', 'insertPoint', 'anchorPointType'] },
    { path: 'src/app/core/session.service.ts', role: 'applies pen and path commands', symbols: ['applyPenBegin', 'applyPenFinish', 'applyDeleteAnchors', 'applyInsertPoint', "from './model/pen-path'"] },
    { path: 'src/app/commands/models/command.ts', role: 'pen and path commands', symbols: ["'pen.begin'", "'path.insertPoint'", "'path.setAnchorType'"] },
    { path: 'src/app/commands/models/history.ts', role: 'labels and coalescing', symbols: ["case 'pen.begin'", "case 'path.deleteAnchors'", 'gestureContinues'] },
    { path: 'src/app/commands/models/editor-tools.ts', role: 'tool labels', symbols: ["label: 'Pen'", "label: 'Direct select'", "label: 'Add point'"] },
    { path: 'src/app/keymap/services/keymap.service.ts', role: 'shortcuts', symbols: ["p: 'pen'", "a: 'direct-select'", "'pen.finish'", "'path.deleteAnchors'", 'setEditSelectionKind'] },
    { path: 'src/app/keymap/services/keymap.service.spec.ts', role: 'shortcut tests', symbols: ['finishes an open pen stroke', 'selects the add point tool'] },
    { path: 'src/app/viewport/utils/tools/pen.ts', role: 'pen placement', symbols: ['startPen', 'updatePenDrag', 'penPreviewData', 'PEN_DRAG_THRESHOLD_PX'] },
    { path: 'src/app/viewport/utils/tools/pen.spec.ts', role: 'pen tool tests', symbols: ['closes on the first anchor'] },
    { path: 'src/app/viewport/utils/tools/direct-select.ts', role: 'edit-mode drag', symbols: ['beginDirectDrag', 'updateDirectDrag', 'finishDirectDrag', 'DIRECT_SELECT_THRESHOLD_PX'] },
    { path: 'src/app/viewport/utils/tools/add-point.ts', role: 'segment hit', symbols: ['hitTestSegment', 'addPointHitRadius', 'ADD_POINT_HIT_PX'] },
    { path: 'src/app/viewport/utils/tools/add-point.spec.ts', role: 'add-point tests', symbols: ['ignores the endpoints'] },
    { path: 'src/app/viewport/components/viewport/viewport.ts', role: 'pen, direct, add-point gestures', symbols: ['beginPen', 'movePen', 'finishPen', 'beginDirect', 'beginAddPoint', 'penPreview'] },
    { path: 'src/app/viewport/components/viewport/viewport.html', role: 'anchor overlay and pen preview', symbols: ['class="anchor"', 'class="pen-preview"'] },
    { path: 'src/app/viewport/components/viewport/viewport.spec.ts', role: 'canvas gesture tests', symbols: ['draws a cubic with the pen', 'moves one with direct select', 'adds a point on the active path'] },
    { path: 'src/app/panels/options/components/anchor-options/anchor-options.ts', role: 'numeric anchor edits', symbols: ["'path.setAnchor'", "'path.setHandle'", "'path.setAnchorType'"] },
    { path: 'src/app/panels/options/components/options-panel/options-panel.spec.ts', role: 'point type tests', symbols: ['changes the selected point type'] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/core/model/pen-path.spec.ts --include=src/app/core/model/edit-path.spec.ts --include=src/app/viewport/utils/tools/pen.spec.ts --include=src/app/viewport/utils/tools/add-point.spec.ts --include=src/app/viewport/components/viewport/viewport.spec.ts --include=src/app/keymap/services/keymap.service.spec.ts --include=src/app/panels/options/components/options-panel/options-panel.spec.ts',
  gotchas: [
    'pen.begin, pen.addPoint, and pen.setHandles share the history label Pen. The handle drag is sent as gesture continue, so it joins that entry.',
    'pen.finish records Close path only when closed is true. Enter finishes an open stroke and records nothing.',
    'A click on the first anchor closes the path only when it already has two or more anchors. A click on the only anchor does nothing.',
    'The model barrel exports edit-path and does not re-export pen-path. Session imports ./model/pen-path directly.',
    'Add point is a single path.insertPoint. It does not capture the pointer or call beginClipperHold.',
    'Keys 1 and 2 change editSelectionKind. No gesture writes selectedSegmentIds.',
    'Direct select in object mode does not enter edit mode. Select clicks are ignored in edit mode.',
    'Camera, snap, and pointer routing belong to the viewport skill.',
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
  console.log(failures === 0 ? 'Cache is fresh.' : `${failures} stale entries; update the cache in path-editing.mjs.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

function print() {
  console.log('Tools:');
  for (const [id, tool] of Object.entries(cache.tools)) {
    console.log(`  ${id.padEnd(14)} ${tool.shortcut.padEnd(8)} ${tool.mode}`);
  }
  console.log('\nModel:');
  for (const [key, value] of Object.entries(cache.model)) {
    console.log(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
  console.log('\nCommands:');
  for (const [type, label] of Object.entries(cache.commands)) {
    console.log(`  ${type}: ${label}`);
  }
  console.log('\nGestures:');
  for (const [key, value] of Object.entries(cache.gestures)) {
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
