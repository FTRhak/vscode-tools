#!/usr/bin/env node
// Cached map of the viewport (canvas) in vector-editor.
// Usage (from vector-editor/):
//   node .cursor/skills/viewport/scripts/viewport.mjs           print the cache
//   node .cursor/skills/viewport/scripts/viewport.mjs --check   verify every cached symbol still exists
//   node .cursor/skills/viewport/scripts/viewport.mjs --json    print the cache as JSON

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  camera: {
    zoom: [0.02, 64],
    padding: 24,
    wheel: 'zoomAtPoint toward the cursor; preventDefault; not a history step',
    fit: 'fitArtboard once per document id when the host has a size',
    transform: 'translate(panX panY) scale(zoom)',
  },
  routing: [
    'ignore [data-shape-dialog]',
    'space+primary or middle button -> pan',
    'pen -> beginPen',
    'add-point -> beginAddPoint',
    'empty-point -> beginEmptyPoint',
    'image -> beginImage',
    'shape kind -> beginShape (see figure skill)',
    'direct-select -> beginDirect',
    'else -> beginSelect',
  ],
  gestures: {
    threshold: 'GESTURE_THRESHOLD_PX = 4 (also DIRECT_SELECT and PEN_DRAG)',
    select: 'object mode; click, Shift toggle, empty click clears, marquee replaces',
    direct: 'edit mode only; anchors, handle, or marquee; Alt breaks the handle',
    addPoint: 'edit mode, active path, ADD_POINT_HIT_PX = 8',
    emptyPoint: 'object mode; places a reference marker',
    origin: 'drag the rotation origin; the object does not translate',
    pan: 'space (canvas focused) or middle button; auxclick preventDefault',
    hold: "beginClipperHold() on a document-changing drag",
  },
  hit: {
    objects: 'front of paint order first; evaluated geometry; empty point radius 8px; inside/outside stroke uses the full width on that side of a closed path',
    anchors: 'local space; anchors before handles; ANCHOR_HIT_PX = 6',
    locked: 'isInteractionLocked blocks moves, not selection',
  },
  snap: {
    modes: ['off', 'grid_100', 'grid_010', 'grid_001', 'object', 'layer'],
    steps: { grid_100: 1, grid_010: 0.1, grid_001: 0.01 },
    threshold: 'SNAP_THRESHOLD_PX = 8',
    object: 'other objects on the same layer',
    layer: 'objects on every layer',
    bar: 'SnapBar stops pointerdown so the canvas does not start a gesture',
  },
  files: [
    { path: 'src/app/viewport/utils/camera.ts', role: 'fit, zoom, pan, screen mapping', symbols: ['fitArtboard', 'zoomAtPoint', 'screenToDocument', 'panBy', 'wheelZoomFactor', 'cameraTransformAttribute', 'MIN_ZOOM', 'MAX_ZOOM', 'ARTBOARD_FIT_PADDING'] },
    { path: 'src/app/viewport/utils/camera.spec.ts', role: 'camera tests', symbols: ['fitArtboard'] },
    { path: 'src/app/viewport/utils/hit-test.ts', role: 'object and marquee hits', symbols: ['hitTestObject', 'objectsInRect', 'documentToLocal', 'localToDocument', 'documentDeltaToLocal', 'EMPTY_POINT_HIT_PX'] },
    { path: 'src/app/viewport/utils/hit-test.spec.ts', role: 'hit-test tests', symbols: ['hitTestObject'] },
    { path: 'src/app/viewport/utils/anchor-hit.ts', role: 'anchor and handle hits', symbols: ['hitTestAnchor', 'anchorsInRect', 'anchorHitRadius', 'ANCHOR_HIT_PX'] },
    { path: 'src/app/viewport/utils/anchor-hit.spec.ts', role: 'anchor hit tests', symbols: ['hitTestAnchor'] },
    { path: 'src/app/viewport/utils/snap.ts', role: 'grid and object snap', symbols: ['SNAP_MODES', 'SNAP_THRESHOLD_PX', 'gridStep', 'snapToGrid', 'snapToPoints', 'snapTranslation', 'collectSnapTargets'] },
    { path: 'src/app/viewport/utils/snap.spec.ts', role: 'snap tests', symbols: ['snapToGrid'] },
    { path: 'src/app/viewport/utils/scene.ts', role: 'render model', symbols: ['sceneFromDocument', 'formatObjectTransform', 'effectiveStrokeAlign'] },
    { path: 'src/app/viewport/utils/tools/direct-select.ts', role: 'edit-mode drag', symbols: ['beginDirectDrag', 'updateDirectDrag', 'finishDirectDrag', 'DIRECT_SELECT_THRESHOLD_PX'] },
    { path: 'src/app/viewport/utils/tools/pen.ts', role: 'pen placement', symbols: ['startPen', 'updatePenDrag', 'penPreviewData', 'PEN_DRAG_THRESHOLD_PX'] },
    { path: 'src/app/viewport/utils/tools/pen.spec.ts', role: 'pen tests', symbols: ['startPen'] },
    { path: 'src/app/viewport/utils/tools/add-point.ts', role: 'segment insertion hit', symbols: ['hitTestSegment', 'addPointHitRadius', 'ADD_POINT_HIT_PX'] },
    { path: 'src/app/viewport/utils/tools/add-point.spec.ts', role: 'add-point tests', symbols: ['hitTestSegment'] },
    { path: 'src/app/viewport/components/viewport/viewport.ts', role: 'pointer router', symbols: ['onPointerDown', 'beginPan', 'beginSelect', 'beginDirect', 'beginImage', 'listenToWheel', 'fitNewDocuments', 'pointerToDocument', 'GESTURE_THRESHOLD_PX', 'beginClipperHold'] },
    { path: 'src/app/viewport/utils/image-frame.ts', role: 'image place frame', symbols: ['imageFrameAt', 'imageFrameFromDrag'] },
    { path: 'src/app/viewport/services/image-place.service.ts', role: 'armed raster file', symbols: ['class ImagePlace', 'requestPick'] },
    { path: 'src/app/viewport/components/viewport/viewport.html', role: 'artboard, overlays, snap bar', symbols: ['cameraTransform()', 'class="artboard"', 'app-snap-bar'] },
    { path: 'src/app/viewport/components/viewport/viewport.spec.ts', role: 'gesture tests', symbols: ['fits the artboard', 'zooms toward the cursor', 'pans with the middle button'] },
    { path: 'src/app/viewport/components/snap-bar/snap-bar.ts', role: 'snap mode control', symbols: ['stopPropagation', 'data-snap-bar'] },
    { path: 'src/app/keymap/services/keymap.service.ts', role: 'viewport-only shortcuts', symbols: ['isViewportTarget', 'data-viewport'] },
    { path: 'src/app/commands/models/history.ts', role: 'camera is not history', symbols: ["case 'session.setViewport'"] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/viewport/utils/camera.spec.ts --include=src/app/viewport/utils/hit-test.spec.ts --include=src/app/viewport/utils/scene.spec.ts --include=src/app/viewport/utils/anchor-hit.spec.ts --include=src/app/viewport/utils/snap.spec.ts --include=src/app/viewport/utils/tools/pen.spec.ts --include=src/app/viewport/utils/tools/add-point.spec.ts --include=src/app/viewport/components/viewport/viewport.spec.ts',
  gotchas: [
    'The wheel listener must be { passive: false } or preventDefault is ignored.',
    'session.setViewport returns null from historyLabel, so pan and zoom are not undo steps.',
    'Select clicks are ignored in edit mode. Direct select in object mode does not enter edit mode.',
    'SnapBar pointerdown calls stopPropagation so it does not start a canvas gesture.',
    'Viewport pointerdown ignores events from [data-shape-dialog].',
    'Shape drag, the size dialog, and shape shortcuts belong to the figure skill.',
    'Pen placement, direct-select drags, and add-point hits belong to the path-editing skill.',
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
  console.log(failures === 0 ? 'Cache is fresh.' : `${failures} stale entries; update the cache in viewport.mjs.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

function print() {
  console.log('Camera:');
  for (const [key, value] of Object.entries(cache.camera)) {
    console.log(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
  console.log('\nRouting:');
  for (const step of cache.routing) {
    console.log(`  - ${step}`);
  }
  console.log('\nGestures:');
  for (const [key, value] of Object.entries(cache.gestures)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nHit:');
  for (const [key, value] of Object.entries(cache.hit)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nSnap:');
  for (const [key, value] of Object.entries(cache.snap)) {
    console.log(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
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
