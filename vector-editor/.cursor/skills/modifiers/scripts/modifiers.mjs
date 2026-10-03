#!/usr/bin/env node
// Cached map of the modifier stack in vector-editor.
// Usage (from vector-editor/):
//   node .cursor/skills/modifiers/scripts/modifiers.mjs           print the cache
//   node .cursor/skills/modifiers/scripts/modifiers.mjs --check   verify every cached symbol still exists
//   node .cursor/skills/modifiers/scripts/modifiers.mjs --json    print the cache as JSON

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  kinds: {
    array: 'count 3, offset 40,0; replicas keep segment kind',
    mirror: "axis 'x'; optional empty-point center, otherwise bounds center",
    bevel: "distance 8, join 'bevel', miterLimit 4; Clipper inflatePaths",
    round: 'mode direct, roundness 50, anchorCount from prior output or 4',
    boolean: "operation 'difference'; first other path, or an empty operandId",
  },
  stack: {
    order: 'array, mirror, round, then bevel, then boolean',
    disabled: 'skipped; source stays as the previous step left it',
    hold: 'captureClipperHold freezes bevel and boolean; array, mirror, and round stay live',
    apply: 'remintSource of the prefix; later modifiers remain',
    applyAll: 'remintSource of the full stack; modifiers become []',
    fillRule: "evenodd after a boolean that ran; otherwise the object fillRule",
    empty: 'add, update, remove, reorder, and apply return the same empty point',
  },
  commands: {
    'modifier.add': 'Add modifier',
    'modifier.update': 'Update modifier',
    'modifier.remove': 'Remove modifier',
    'modifier.reorder': 'Reorder modifier',
    'modifier.apply': 'Apply modifier',
    'modifier.applyAll': 'Apply modifiers',
  },
  diagnostics: [
    'Mirror reference point is missing.',
    'Mirror reference point cannot be transformed into object space.',
    'Bevel could not be computed.',
    'Boolean operand is missing.',
    'Boolean operand is the same object.',
    'Boolean operands form a cycle.',
    'Boolean transform cannot be inverted.',
    'Boolean needs closed paths.',
    'Boolean could not be computed.',
  ],
  files: [
    { path: 'src/app/core/model/types.ts', role: 'Modifier union', symbols: ["type: 'array'", "type: 'mirror'", "type: 'bevel'", "type: 'round'", "type: 'boolean'"] },
    { path: 'src/app/core/model/modifier-edits.ts', role: 'stack edits and defaults', symbols: ['addModifier', 'updateModifier', 'removeModifier', 'reorderModifier', 'applyModifier', 'applyAllModifiers', 'ModifierKind', 'count: 3', 'offsetX: 40', 'roundness: 50', "operation: 'difference'"] },
    { path: 'src/app/core/eval/evaluate.ts', role: 'stack walk', symbols: ['evaluateDocument', 'evaluateObjectPrefix', 'captureClipperHold', 'Boolean needs closed paths.', 'Mirror reference point is missing.'] },
    { path: 'src/app/core/eval/evaluate.spec.ts', role: 'evaluation tests', symbols: ['freezes clipper output during a hold', 'reports open paths, a missing operand, a self operand, a cycle, and a singular transform'] },
    { path: 'src/app/core/eval/array.ts', role: 'array copies', symbols: ['applyArray', 'arrayCount'] },
    { path: 'src/app/core/eval/mirror.ts', role: 'mirror copies', symbols: ['applyMirror'] },
    { path: 'src/app/core/eval/bevel.ts', role: 'Clipper bevel', symbols: ['applyBevel', 'inflatePaths'] },
    { path: 'src/app/core/eval/round.ts', role: 'round resample', symbols: ['applyRound'] },
    { path: 'src/app/core/eval/boolean.ts', role: 'Clipper boolean', symbols: ['clipBoolean', 'hasOpenSubpath', 'placeOperand'] },
    { path: 'src/app/core/eval/remint.ts', role: 'fresh ids on apply', symbols: ['remintSource'] },
    { path: 'src/app/core/session.service.ts', role: 'applies modifier commands', symbols: ["case 'modifier.add'", 'applyBakedModifier', "from './model/modifier-edits'"] },
    { path: 'src/app/commands/models/command.ts', role: 'modifier commands', symbols: ["'modifier.add'", "'modifier.applyAll'", 'ModifierKind'] },
    { path: 'src/app/commands/models/history.ts', role: 'history labels', symbols: ["case 'modifier.apply'", "'Apply modifiers'"] },
    { path: 'src/app/commands/services/command-bus.service.spec.ts', role: 'apply and undo', symbols: ['bakes an array prefix, clears anchor selection, and undo restores the stack'] },
    { path: 'src/app/commands/services/empty-point.commands.spec.ts', role: 'empty-point rejection', symbols: ['does not add a modifier to an empty point'] },
    { path: 'src/app/core/io/svg-export.ts', role: 'modifier payload', symbols: ['modifierPayload', 'data-vector-editor'] },
    { path: 'src/app/core/io/svg-import.ts', role: 'modifier restore', symbols: ['readModifiers', 'readModifier'] },
    { path: 'src/app/core/io/svg-io.spec.ts', role: 'modifier round-trip', symbols: ['restores modifier settings and defaults older round modes to direct'] },
    { path: 'src/app/panels/modifiers/components/modifiers-panel/modifiers-panel.ts', role: 'add, reorder, apply all', symbols: ["'modifier.add'", 'evaluateDocument'] },
    { path: 'src/app/panels/modifiers/components/modifiers-panel/modifiers-panel.html', role: 'panel actions', symbols: ['Add modifier', 'Apply all'] },
    { path: 'src/app/panels/modifiers/components/modifiers-panel/modifiers-panel.spec.ts', role: 'panel test', symbols: ['edits the active object stack from the panel'] },
    { path: 'src/app/panels/modifiers/components/modifier-row/modifier-row.ts', role: 'row commands', symbols: ["'modifier.apply'", "'modifier.update'", "'modifier.remove'"] },
    { path: 'src/app/panels/modifiers/components/array-modifier-fields/array-modifier-fields.ts', role: 'array fields', symbols: ['ArrayModifierFields'] },
    { path: 'src/app/panels/modifiers/components/mirror-modifier-fields/mirror-modifier-fields.ts', role: 'mirror fields', symbols: ['MirrorModifierFields'] },
    { path: 'src/app/panels/modifiers/components/bevel-modifier-fields/bevel-modifier-fields.ts', role: 'bevel fields', symbols: ['BevelModifierFields'] },
    { path: 'src/app/panels/modifiers/components/round-modifier-fields/round-modifier-fields.ts', role: 'round fields', symbols: ['RoundModifierFields'] },
    { path: 'src/app/panels/modifiers/components/boolean-modifier-fields/boolean-modifier-fields.ts', role: 'boolean fields', symbols: ['BooleanModifierFields'] },
    { path: 'src/app/panels/modifiers/modifiers.module.ts', role: 'panel module', symbols: ['ArrayModifierFields', 'BooleanModifierFields'] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/core/eval/evaluate.spec.ts --include=src/app/commands/services/command-bus.service.spec.ts --include=src/app/commands/services/empty-point.commands.spec.ts --include=src/app/panels/modifiers/components/modifiers-panel/modifiers-panel.spec.ts --include=src/app/core/io/svg-io.spec.ts',
  gotchas: [
    'modifier-edits.ts is imported by session.service.ts and is not re-exported from the model barrel.',
    'Empty points ignore add, update, remove, reorder, and apply. The panel says modifiers do not apply to them.',
    'Apply remints ids. A boolean that ran also writes fillRule evenodd onto the baked style.',
    'Apply clears anchor and segment selection only when the baked object is the active object.',
    'Clipper steps freeze during beginClipperHold. Array, mirror, and round keep evaluating.',
    'Round anchorCount clamps to 2..1000 and roundness to 0..100. A missing mode is direct.',
    'Boolean operandId and mirror centerPointId become indexes in optimized SVG. Minimal mode drops modifiers.',
    'A new modifier field must be written in modifierPayload and read in readModifier.',
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
  console.log(failures === 0 ? 'Cache is fresh.' : `${failures} stale entries; update the cache in modifiers.mjs.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

function print() {
  console.log('Kinds:');
  for (const [id, summary] of Object.entries(cache.kinds)) {
    console.log(`  ${id.padEnd(10)} ${summary}`);
  }
  console.log('\nStack:');
  for (const [key, value] of Object.entries(cache.stack)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('\nCommands:');
  for (const [type, label] of Object.entries(cache.commands)) {
    console.log(`  ${type}: ${label}`);
  }
  console.log('\nDiagnostics:');
  for (const line of cache.diagnostics) {
    console.log(`  ${line}`);
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
