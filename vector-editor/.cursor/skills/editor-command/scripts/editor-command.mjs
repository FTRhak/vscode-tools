#!/usr/bin/env node
// Cached catalog of editor commands in vector-editor.
// Usage (from vector-editor/):
//   node .cursor/skills/editor-command/scripts/editor-command.mjs           print the catalog
//   node .cursor/skills/editor-command/scripts/editor-command.mjs --check   verify commands, handlers, history, tests
//   node .cursor/skills/editor-command/scripts/editor-command.mjs --json    print the cache as JSON

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export const cache = {
  commands: {
    'session.setMode': { handler: 'applyMode', history: null },
    'session.setTool': { handler: 'applyTool', history: null },
    'session.setEditSelectionKind': { handler: 'applyEditSelectionKind', history: null },
    'document.new': { handler: 'createNewDocument', history: 'New document' },
    'document.replace': { handler: 'defaultLayerId(command.document)', history: 'Open' },
    'session.setViewport': { handler: 'command.panX', history: null },
    'session.select': { handler: 'applySelect', history: 'Select' },
    'session.selectLayer': { handler: 'applySelectLayer', history: null },
    'path.translateAnchors': { handler: 'translateAnchors', history: 'Move anchors' },
    'path.setAnchor': { handler: 'setAnchorPosition', history: 'Set anchor' },
    'path.setHandle': {
      handler: 'setAnchorHandle',
      history: 'Set handle',
      labels: ['Set handle', 'Move handle'],
    },
    'path.setAnchorType': { handler: 'setAnchorPointType', history: 'Set point type' },
    'path.deleteAnchors': { handler: 'applyDeleteAnchors', history: 'Delete anchors' },
    'path.insertPoint': { handler: 'applyInsertPoint', history: 'Add point' },
    'object.translate': { handler: 'applyTranslate', history: 'Move' },
    'object.setTransform': { handler: 'applyTransform', history: 'Set transform' },
    'object.setRotationOrigin': {
      handler: 'applyRotationOrigin',
      history: 'Set rotation origin',
      labels: ['Set rotation origin', 'Move rotation origin'],
    },
    'object.applyTransform': { handler: 'applyBakedTransform', history: 'Apply transform' },
    'object.setFlags': {
      handler: 'applyFlags',
      history: 'Rename',
      labels: ['Rename', 'Show', 'Hide', 'Lock', 'Unlock'],
    },
    'object.duplicate': { handler: 'applyDuplicate', history: 'Duplicate' },
    'object.delete': { handler: 'applyDelete', history: 'Delete' },
    'style.set': {
      handler: 'setObjectStyle',
      history: 'Set style',
      labels: [
        'Set fill',
        'Set stroke',
        'Set stroke width',
        'Set line cap',
        'Set line join',
        'Set miter limit',
        'Set stroke opacity',
        'Set dash offset',
        'Set dash array',
        'Set style',
      ],
    },
    'gradient.create': { handler: 'createGradient', history: 'Create gradient' },
    'gradient.update': { handler: 'updateGradient', history: 'Update gradient' },
    'gradient.delete': { handler: 'deleteGradient', history: 'Delete gradient' },
    'swatch.add': { handler: 'addSwatch', history: 'Add swatch' },
    'swatch.apply': { handler: 'applySwatch', history: 'Apply swatch' },
    'layer.add': { handler: 'applyAddLayer', history: 'Add layer' },
    'layer.update': {
      handler: 'updateLayer',
      history: 'Rename layer',
      labels: ['Rename layer', 'Show layer', 'Hide layer', 'Lock layer', 'Unlock layer'],
    },
    'layer.reorder': { handler: 'reorderLayer', history: 'Reorder layer' },
    'layer.delete': { handler: 'applyDeleteLayer', history: 'Delete layer' },
    'path.add': { handler: 'applyAddPath', history: 'Add path' },
    'point.add': { handler: 'applyPointAdd', history: 'Add empty point' },
    'shape.add': { handler: 'applyShapeAdd', history: 'Add shape' },
    'pen.begin': { handler: 'applyPenBegin', history: 'Pen' },
    'pen.addPoint': { handler: 'applyPenAddPoint', history: 'Pen' },
    'pen.setHandles': { handler: 'applyPenSetHandles', history: 'Pen' },
    'pen.finish': { handler: 'applyPenFinish', history: 'Close path' },
    'modifier.add': { handler: 'addModifier', history: 'Add modifier' },
    'modifier.update': { handler: 'updateModifier', history: 'Update modifier' },
    'modifier.remove': { handler: 'removeModifier', history: 'Remove modifier' },
    'modifier.reorder': { handler: 'reorderModifier', history: 'Reorder modifier' },
    'modifier.apply': { handler: 'applyModifier', history: 'Apply modifier' },
    'modifier.applyAll': { handler: 'applyAllModifiers', history: 'Apply modifiers' },
    'history.undo': { handler: 'undoSession', history: null },
    'history.redo': { handler: 'redoSession', history: null },
    'history.jump': { handler: 'jumpSession', history: null },
  },
  untested: {
    'session.setEditSelectionKind': 'Dispatched from keymap.service.ts. No spec names this command.',
    'path.setAnchor': 'No CommandBus dispatch. Anchor edits are covered by edit-path.spec.ts.',
    'path.setHandle': 'No CommandBus dispatch. Handle edits are covered by edit-path.spec.ts.',
    'path.setAnchorType': 'No CommandBus dispatch. Point types are covered by edit-path.spec.ts.',
    'path.insertPoint': 'No CommandBus dispatch. The add-point gesture is covered by viewport.spec.ts.',
    'shape.add': 'No CommandBus dispatch. The rectangle drag is covered by viewport.spec.ts.',
    'modifier.remove': 'No CommandBus dispatch. Add, update, reorder, and apply are covered.',
  },
  coalesce: [
    'object.translate',
    'object.setRotationOrigin',
    'path.translateAnchors',
    'path.setHandle',
    'pen.setHandles',
  ],
  files: [
    { path: 'src/app/commands/models/command.ts', role: 'Command union', symbols: ['export type Command', "'shape.add'"] },
    { path: 'src/app/commands/models/history.ts', role: 'history labels and coalesce', symbols: ['function historyLabel', 'function recordHistory', 'function gestureContinues'] },
    { path: 'src/app/commands/services/command-bus.service.ts', role: 'dispatch', symbols: ['export class CommandBus', 'dispatch(command: Command)'] },
    { path: 'src/app/core/session.service.ts', role: 'apply and commit', symbols: ['export function applySessionCommand', 'export function commitSession'] },
    { path: 'src/app/commands/services/command-bus.service.spec.ts', role: 'command tests', symbols: ["describe('CommandBus'"] },
  ],
  tests: 'npx ng test --watch=false --include=src/app/commands/services/command-bus.service.spec.ts --include=src/app/commands/services/empty-point.commands.spec.ts',
  gotchas: [
    'history.undo, history.redo, and history.jump run in commitSession, not applySessionCommand.',
    'A labeled command that leaves document, mode, and selection unchanged is not recorded.',
    "gesture: 'continue' coalesces only when the open history label matches.",
    'object.setFlags and layer.update return null when name, visible, and locked are all omitted.',
    'pen.finish records Close path only when closed is true.',
    'setTool clears penObjectId unless the tool is pen.',
  ],
};

function read(path) {
  const full = resolve(root, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

function commandTypes(text) {
  const start = text.indexOf('export type Command =');
  const body = start === -1 ? '' : text.slice(start);
  return [...body.matchAll(/type:\s*'([^']+)'/g)].map((match) => match[1]);
}

function gestureTypes(text) {
  const start = text.indexOf('function gestureContinues');
  if (start === -1) {
    return [];
  }
  const body = text.slice(start);
  const end = body.indexOf('\nfunction ');
  const fn = end === -1 ? body : body.slice(0, end);
  return [...fn.matchAll(/command\.type === '([^']+)'/g)].map((match) => match[1]);
}

function specFiles() {
  const dir = resolve(root, 'src');
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { recursive: true })
    .map((file) => String(file).replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.spec.ts'))
    .map((file) => ({
      path: `src/${file}`,
      text: readFileSync(resolve(dir, file), 'utf8'),
    }));
}

function quoted(label) {
  return `'${label}'`;
}

function analyze() {
  const failures = [];
  const commandText = read('src/app/commands/models/command.ts');
  const sessionText = read('src/app/core/session.service.ts');
  const historyText = read('src/app/commands/models/history.ts');
  if (!commandText || !sessionText || !historyText) {
    failures.push('MISSING FILE  command.ts, session.service.ts, or history.ts');
    return { rows: [], failures };
  }

  for (const file of cache.files) {
    const text = read(file.path);
    if (text === null) {
      failures.push(`MISSING FILE  ${file.path}`);
      continue;
    }
    for (const symbol of file.symbols) {
      if (!text.includes(symbol)) {
        failures.push(`STALE         ${file.path}: ${symbol}`);
      }
    }
  }

  const types = commandTypes(commandText);
  const seen = new Set();
  for (const type of types) {
    if (seen.has(type)) {
      failures.push(`DUPLICATE     ${type} in Command`);
    }
    seen.add(type);
  }

  const cached = new Set(Object.keys(cache.commands));
  for (const type of types) {
    if (!cached.has(type)) {
      failures.push(`MISSING CACHE ${type}`);
    }
  }
  for (const type of cached) {
    if (!seen.has(type)) {
      failures.push(`STALE CACHE   ${type} is not a Command`);
    }
  }

  const specs = specFiles();
  const rows = [];
  for (const type of types) {
    const entry = cache.commands[type];
    if (!entry) {
      continue;
    }
    const handled =
      sessionText.includes(`case '${type}'`) || sessionText.includes(`command.type === '${type}'`);
    if (!handled) {
      failures.push(`NO HANDLER    ${type}`);
    } else if (!sessionText.includes(entry.handler)) {
      failures.push(`STALE         session.service.ts: ${type} handler ${entry.handler}`);
    }
    if (!historyText.includes(`case '${type}'`)) {
      failures.push(`NO HISTORY    ${type}`);
    }
    const labels = entry.labels ?? (entry.history ? [entry.history] : []);
    for (const label of labels) {
      if (!historyText.includes(quoted(label))) {
        failures.push(`STALE LABEL   ${type}: ${label}`);
      }
    }

    const tests = specs.filter((spec) => spec.text.includes(quoted(type))).map((spec) => spec.path);
    const reason = cache.untested[type];
    if (tests.length === 0 && !reason) {
      failures.push(`NO TEST       ${type}: add a spec or cache.untested reason`);
    }
    if (tests.length > 0 && reason) {
      failures.push(`STALE REASON  ${type} is dispatched by ${tests[0]}`);
    }
    rows.push({ type, entry, tests, reason });
  }

  for (const type of Object.keys(cache.untested)) {
    if (!cached.has(type)) {
      failures.push(`STALE REASON  ${type} is not in cache.commands`);
    }
  }

  const coalesce = gestureTypes(historyText);
  const expected = new Set(cache.coalesce);
  for (const type of coalesce) {
    if (!expected.has(type)) {
      failures.push(`MISSING CACHE coalesce ${type}`);
    }
  }
  for (const type of cache.coalesce) {
    if (!coalesce.includes(type)) {
      failures.push(`STALE         coalesce ${type} is not in gestureContinues`);
    }
  }

  return { rows, failures };
}

function print() {
  const { rows, failures } = analyze();
  const groups = new Map();
  for (const row of rows) {
    const name = row.type.slice(0, row.type.indexOf('.'));
    const group = groups.get(name) ?? [];
    group.push(row);
    groups.set(name, group);
  }
  for (const [name, group] of groups) {
    console.log(`\n${name}`);
    for (const row of group) {
      const history = row.entry.history ?? '—';
      const test = row.tests[0] ?? `UNTESTED  ${row.reason}`;
      console.log(`  ${row.type.padEnd(28)} ${history.padEnd(22)} ${row.entry.handler}`);
      console.log(`  ${''.padEnd(28)} ${test}`);
    }
  }
  console.log(`\nTests: ${cache.tests}`);
  console.log('\nGotchas:');
  for (const item of cache.gotchas) {
    console.log(`  - ${item}`);
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} catalog issues. Run --check for the list.`);
  }
}

function check() {
  const { failures } = analyze();
  if (failures.length === 0) {
    console.log('Cache is fresh.');
    return;
  }
  for (const failure of failures) {
    console.log(failure);
  }
  console.log(`${failures.length} catalog issues; update the cache in editor-command.mjs.`);
  process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  check();
} else if (args.includes('--json')) {
  console.log(JSON.stringify(cache, null, 2));
} else {
  print();
}
