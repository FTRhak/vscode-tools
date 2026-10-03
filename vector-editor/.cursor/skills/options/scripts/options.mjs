#!/usr/bin/env node
// Cached map of the Options panel in vector-editor.
// Usage (from vector-editor/):
//   node .cursor/skills/options/scripts/options.mjs           print the cache
//   node .cursor/skills/options/scripts/options.mjs --check   verify every cached symbol still exists
//   node .cursor/skills/options/scripts/options.mjs --json    print the cache as JSON

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  modes: {
    object: "mode 'object' and a selected object -> object-options",
    anchor: "else mode 'edit' and selected anchors on the active object -> anchor-options",
    empty: 'else Nothing selected.',
  },
  objectFields: {
    name: "object.setFlags { name } after trim; empty is ignored",
    visible: "checkbox; indeterminate when mixed; object.setFlags { visible }",
    locked: "checkbox; indeterminate when mixed; object.setFlags { locked }",
    transform: 'x, y, rotation, scaleX, scaleY via object.setTransform',
    pivot: 'pivotX/pivotY are rotationOriginDocument; object.setRotationOrigin without gesture',
    apply: 'active object only; disabled unless the transform is non-identity and unlocked',
    reset: 'every selected unlocked non-identity object; object.setTransform identity',
    layer: 'read-only layer name',
  },
  anchorFields: {
    type: "corner | smooth | symmetric | line; mixed is a disabled option; path.setAnchorType",
    position: 'x, y via path.setAnchor; handles shift with the anchor',
    handles: 'in/out x/y via path.setHandle; breakLink is always true',
    delta: "dX/dY only when 2+ anchors; path.translateAnchors gesture 'begin'; 0,0 skipped",
  },
  history: {
    'object.setFlags': 'Rename, Show, Hide, Lock, Unlock',
    'object.setTransform': 'Set transform',
    'object.setRotationOrigin': 'Set rotation origin (panel sends no gesture)',
    'object.applyTransform': 'Apply transform',
    'path.setAnchor': 'Set anchor',
    'path.setHandle': 'Set handle (panel sends no gesture)',
    'path.setAnchorType': 'Set point type',
    'path.translateAnchors': 'Move anchors',
  },
  files: [
    { path: 'src/app/panels/options/components/options-panel/options-panel.ts', role: 'mode switch', symbols: ['showObjectOptions', 'showAnchorOptions', 'anchorsOfActive', 'standalone: false'] },
    { path: 'src/app/panels/options/components/options-panel/options-panel.html', role: 'panel body', symbols: ['object-options', 'anchor-options', 'Nothing selected'] },
    { path: 'src/app/panels/options/components/options-panel/options-panel.spec.ts', role: 'panel tests', symbols: ['writes X on Enter', 'Set point type', 'Nothing selected'] },
    { path: 'src/app/panels/options/components/object-options/object-options.ts', role: 'object draft and commits', symbols: ['commitName', 'commitNumber', 'commitPivot', 'applyTransform', 'resetTransform', 'commitFlag', 'linkedSignal', "'object.setFlags'", "'object.setTransform'", "'object.setRotationOrigin'", "'object.applyTransform'"] },
    { path: 'src/app/panels/options/components/object-options/object-options.html', role: 'object fields', symbols: ['Reset transform', 'Apply transform', 'optionsForm.name', "commitPivot('x')"] },
    { path: 'src/app/panels/options/components/anchor-options/anchor-options.ts', role: 'anchor draft and commits', symbols: ['commitPointType', 'commitAnchor', 'commitHandle', 'commitDelta', "'path.setAnchorType'", 'breakLink: true', "'path.translateAnchors'"] },
    { path: 'src/app/panels/options/components/anchor-options/anchor-options.html', role: 'anchor fields', symbols: ['pointTypeValue()', 'showAnchorDelta()', 'Handle in X'] },
    { path: 'src/app/panels/options/options.module.ts', role: 'NgModule', symbols: ['PanelOptionsModule', 'FormField'] },
    { path: 'src/app/panels/options/index.ts', role: 'public export', symbols: ['PanelOptionsModule'] },
    { path: 'src/app/core/model/edit-path.ts', role: 'anchor edits and point type', symbols: ['anchorPointType', 'setAnchorPosition', 'setAnchorPointType'] },
    { path: 'src/app/commands/models/history.ts', role: 'history labels', symbols: ["case 'path.setAnchorType'", 'Set rotation origin'] },
    { path: 'src/app/shell/components/editor-page/editor-page.ts', role: 'hosts the panel', symbols: ['PanelOptionsModule'] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/panels/options/components/options-panel/options-panel.spec.ts',
  gotchas: [
    'These components are standalone: false and declared by PanelOptionsModule. Do not convert them while editing a field.',
    'Signal Forms commit on blur and Enter. Do not dispatch from every input event.',
    'A mixed selection is null in the draft, an indeterminate checkbox, or the disabled Mixed point type.',
    'Panel pivot and handle commits omit gesture, so each commit is its own history step.',
    'subpathCount and anchorCount are computed but not rendered. options-panel.spec.ts still expects the text Subpaths and Anchors.',
    "button() in the spec searches textContent. Apply and Reset are exposed through aria-label and title, not the button text.",
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
  console.log(failures === 0 ? 'Cache is fresh.' : `${failures} stale entries; update the cache in options.mjs.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

function print() {
  console.log('Modes:');
  for (const [key, value] of Object.entries(cache.modes)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nObject fields:');
  for (const [key, value] of Object.entries(cache.objectFields)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nAnchor fields:');
  for (const [key, value] of Object.entries(cache.anchorFields)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nHistory:');
  for (const [key, value] of Object.entries(cache.history)) {
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
