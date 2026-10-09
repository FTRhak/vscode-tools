#!/usr/bin/env node
// Cached map of the shape (figure) tools in vector-editor.
// Usage (from vector-editor/):
//   node .cursor/skills/figure/scripts/figures.mjs           print the cache
//   node .cursor/skills/figure/scripts/figures.mjs --check   verify every cached symbol still exists
//   node .cursor/skills/figure/scripts/figures.mjs --json    print the cache as JSON

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  shapes: {
    rectangle: { name: 'Rectangle', shortcut: 'M', anchors: '4 corners', segments: 'line' },
    ellipse: { name: 'Ellipse', shortcut: 'L', anchors: '4 cubic, ELLIPSE_KAPPA', segments: 'cubic' },
    star: { name: 'Star', shortcut: 'S', count: [3, 32], defaultCount: 5, anchors: '2n, outer/inner', segments: 'line' },
    polygon: { name: 'Polygon', shortcut: 'N', count: [3, 64], defaultCount: 6, anchors: 'n', segments: 'line' },
    rhombus: { name: 'Rhombus', shortcut: 'R', anchors: '4 side midpoints of drag box', segments: 'line' },
  },
  model: {
    objectKind: "'path' (no separate shape kind)",
    style: {
      fill: '#c5d4f0',
      stroke: '#1a1a1a',
      strokeWidth: 4,
      strokeLinecap: 'butt',
      strokeLinejoin: 'miter',
      strokeMiterlimit: 4,
      strokeOpacity: 1,
      strokeDashoffset: 0,
      strokeDasharray: null,
      strokeAlign: 'default',
      fillRule: 'nonzero',
    },
    transform: 'identity; anchors in document coordinates',
    naming: 'nextSeriesName -> Rectangle, Rectangle 2, ...',
    command: "{ type: 'shape.add', name, source: SourcePath }",
    historyLabel: 'Add shape',
    afterAdd: "mode 'object', new path selected, tool stays active",
  },
  gesture: {
    drag: 'preview .shape-preview, commit once on pointerup',
    click: 'travel < GESTURE_THRESHOLD_PX (4px) opens ShapeDialog',
    shift: 'square/circle/diamond; star point up; polygon flat bottom',
    alt: 'from center for rectangle/ellipse/rhombus (star/polygon always centered)',
    ctrl: 'star: freeze outer radius, cursor sets inner; ratio remembered',
    arrows: 'ArrowUp/ArrowDown change star points / polygon sides',
    space: 'move shape while dragging',
    snap: 'snapAbsolute on every pointer point',
  },
  files: [
    { path: 'src/app/core/model/shapes.ts', role: 'geometry + addShape', symbols: ['shapeSourceFromDrag', 'shapeSource', 'addShape', 'clampShapeCount', 'ELLIPSE_KAPPA', 'SHAPE_NAMES', 'isShapeKind', 'flatBottomRotation'] },
    { path: 'src/app/core/model/shapes.spec.ts', role: 'geometry tests', symbols: ['shape geometry'] },
    { path: 'src/app/core/model/index.ts', role: 'model exports', symbols: ['./shapes'] },
    { path: 'src/app/core/index.ts', role: 'core barrel', symbols: ['shapeSourceFromDrag', 'ShapeKind'] },
    { path: 'src/app/commands/models/command.ts', role: 'EditorTool, icons, shape.add', symbols: ["'rectangle'", "'shape.add'"] },
    { path: 'src/app/commands/models/editor-tools.ts', role: 'tool list, Shapes group', symbols: ["group: 'Shapes'", 'editorToolGroups'] },
    { path: 'src/app/commands/models/history.ts', role: 'history label', symbols: ["case 'shape.add'"] },
    { path: 'src/app/core/session.service.ts', role: 'applies shape.add', symbols: ['applyShapeAdd'] },
    { path: 'src/app/keymap/services/keymap.service.ts', role: 'shortcuts', symbols: ["m: 'rectangle'", "r: 'rhombus'"] },
    { path: 'src/app/viewport/components/viewport/viewport.ts', role: 'drag gesture', symbols: ['beginShape', 'updateShapeGesture', 'finishShape', 'nudgeShapeCount', 'shapeDragInput', 'confirmShape', 'interface ShapeGesture'] },
    { path: 'src/app/viewport/components/viewport/viewport.html', role: 'preview + dialog host', symbols: ['shape-preview', 'app-shape-dialog'] },
    { path: 'src/app/viewport/components/viewport/viewport.spec.ts', role: 'gesture test', symbols: ['draws a rectangle path'] },
    { path: 'src/app/viewport/components/shape-dialog/shape-dialog.ts', role: 'numeric dialog (Signal Forms)', symbols: ['ShapeDialog', 'ShapeDialogRequest'] },
    { path: 'src/app/panels/tools/components/tool-icon/tool-icon.ts', role: 'inline SVG shape icons', symbols: ['ToolIcon'] },
    { path: 'src/app/panels/tools/components/tools-panel/tools-panel.html', role: 'Shapes group heading', symbols: ['tool-group'] },
    { path: 'src/app/shell/components/tool-rail/tool-rail.html', role: 'rail separator', symbols: ['tool-divider'] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/core/model/shapes.spec.ts --include=src/app/viewport/components/viewport/viewport.spec.ts --include=src/app/keymap/services/keymap.service.spec.ts',
  gotchas: [
    'Signal Forms: no static min/max or [attr.max] on [formField] inputs (NG8022); use min()/max() validators.',
    'Narrow session.tool() into a const before isShapeKind() so TS narrows it.',
    'Icon font only has e107-e10B; shape icons are inline SVG in ToolIcon.',
    'Viewport pointerdown ignores events from [data-shape-dialog].',
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
  console.log(failures === 0 ? 'Cache is fresh.' : `${failures} stale entries; update the cache in figures.mjs.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

function print() {
  console.log('Shapes:');
  for (const [id, shape] of Object.entries(cache.shapes)) {
    const count = shape.count ? ` count ${shape.count.join('-')} (default ${shape.defaultCount})` : '';
    console.log(`  ${id.padEnd(10)} ${shape.shortcut}  ${shape.anchors}, ${shape.segments}${count}`);
  }
  console.log('\nModel:');
  for (const [key, value] of Object.entries(cache.model)) {
    console.log(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
  console.log('\nGesture:');
  for (const [key, value] of Object.entries(cache.gesture)) {
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
