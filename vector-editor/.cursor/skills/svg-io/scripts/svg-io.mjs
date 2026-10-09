#!/usr/bin/env node
// Cached map of SVG import and export in vector-editor.
// Usage (from vector-editor/):
//   node .cursor/skills/svg-io/scripts/svg-io.mjs           print the cache
//   node .cursor/skills/svg-io/scripts/svg-io.mjs --check   verify every cached symbol still exists
//   node .cursor/skills/svg-io/scripts/svg-io.mjs --json    print the cache as JSON

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  modes: {
    all: 'ids, locks, swatches, source ids, modifier objects as stored',
    optimized: 'no ids, locks, or swatches; segment indexes; operandIndex and centerPointIndex',
    minimal: 'evaluated visible paths only; no editor attributes; empty points omitted',
  },
  attributes: {
    document: 'data-vector-editor-document',
    layer: 'data-vector-editor-layer',
    object: 'data-vector-editor',
    gradientName: 'data-vector-editor-name',
    gradientStop: 'data-vector-editor-stop',
  },
  format: {
    version: 1,
    presentation: 'd is evaluated geometry; payload source wins on import',
    numbers: 'toFixed(3) with trailing zeros trimmed',
    defaultViewBox: '0 0 1200 800',
    exportOrder: 'layers back to front, then objects with an unknown layer id',
    pathCommandsOut: 'M, L, C, Z',
    pathCommandsIn: 'M L H V C S Q T A Z; Q T A become cubics',
    shapesIn: 'path rect circle ellipse line polyline polygon',
    emptyPoint: 'kind empty, zero subpaths; minimal save skips it',
  },
  files: [
    { path: 'src/app/core/io/svg-export.ts', role: 'exportSvg and save modes', symbols: ['export function exportSvg', "export type SaveMode = 'all' | 'optimized' | 'minimal'", "export type ImageLocation = 'preserve' | 'embed' | 'link'", 'const formatVersion = 1', 'data-vector-editor-document', 'data-vector-editor-layer', 'indexedSource', 'operandIndex', 'centerPointIndex', "payload.kind = 'empty'", "payload.kind = 'image'", 'xlink:href', 'stroke-clip-', 'stroke-paint-', "case 'trace'"] },
    { path: 'src/app/core/io/svg-import.ts', role: 'importSvg', symbols: ['export function importSvg', 'skippedTags', 'shapeTags', 'transparentTags', 'operandIndex', 'centerPointIndex', 'readGradients', "json['kind'] === 'empty'", "json['kind'] !== 'image'", 'readStrokeAlign', 'readPayloadWidth', 'function readImage', "value['type'] === 'trace'"] },
    { path: 'src/app/core/io/index.ts', role: 'public io exports', symbols: ['exportSvg', 'importSvg', 'SaveMode', 'SvgImportResult'] },
    { path: 'src/app/core/io/path-data-parse.ts', role: 'SVG path data to SourcePath', symbols: ['export function parsePathData', "kind === 'Q'", "kind === 'A'"] },
    { path: 'src/app/core/io/shapes.ts', role: 'SVG primitives to SourcePath', symbols: ['export function primitiveToSource', 'const KAPPA'] },
    { path: 'src/app/core/io/matrix.ts', role: 'SVG transforms and object matrices', symbols: ['parseSvgTransform', 'matrixFromTransform', 'transformSource', 'identityTransform'] },
    { path: 'src/app/core/model/path-data.ts', role: 'SourcePath to d', symbols: ['export function sourceToPathData', 'return `C '] },
    { path: 'src/app/core/io/svg-io.spec.ts', role: 'round-trip tests', symbols: ["exportSvg(document, 'all')", "exportSvg(document, 'optimized')", "exportSvg(document, 'minimal')", 'importSvg'] },
    { path: 'src/app/core/index.ts', role: 'core barrel', symbols: ['export { exportSvg, importSvg }'] },
    { path: 'src/app/shell/services/file-actions.service.ts', role: 'open and save', symbols: ['importSvg', 'exportSvg', "type: 'document.replace'", 'confirmSave'] },
    { path: 'src/app/shell/components/save-dialog/save-dialog.ts', role: 'save mode choice', symbols: ["signal<SaveMode>('all')"] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/core/io/svg-io.spec.ts --include=src/app/shell/services/file-actions.service.spec.ts',
  gotchas: [
    'all mode JSON.stringifies the modifier object. optimized mode needs an explicit branch in modifierPayload and readModifier.',
    'Import prefers data-vector-editor source over the baked d attribute.',
    'A foreign SVG has no payload: group and element transforms are baked into anchors and transform stays identity.',
    'Boolean operandIndex and mirror centerPointIndex refer to export order, not layer order in the file.',
    'Gradient fills stay as url(#id). Stops need a #rgb or #rrggbb color; other color syntax is dropped.',
    'strokeAlign is inside/outside/default on the object payload for all and optimized. Inside exports a clip and a double stroke-width; outside exports a mask and a use. Payload strokeWidth is the real width when the attribute is doubled, and payload stroke restores the color when the attribute is none. minimal paints the alignment without a payload, so reopening it does not restore alignment.',
    'DOMParser is required. Tests run it through jsdom.',
    'Images export as <image> with href and xlink:href. ImageLocation preserve, embed, or link is an export argument. External URLs are skipped on import. all and optimized keep dataUrl in the payload when the visible href is a file name.',
    'An enabled image trace with regions exports a group of filled paths in all and optimized. The group payload kind is image, so import keeps one image object and ignores the children. Minimal exports those paths with no editor attributes.',
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
  console.log(failures === 0 ? 'Cache is fresh.' : `${failures} stale entries; update the cache in svg-io.mjs.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

function print() {
  console.log('Save modes:');
  for (const [id, summary] of Object.entries(cache.modes)) {
    console.log(`  ${id.padEnd(10)} ${summary}`);
  }
  console.log('\nAttributes:');
  for (const [key, value] of Object.entries(cache.attributes)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nFormat:');
  for (const [key, value] of Object.entries(cache.format)) {
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
