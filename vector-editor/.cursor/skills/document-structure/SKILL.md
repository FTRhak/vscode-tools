---
name: document-structure
description: Changes or debugs layers, objects, selection, paint order, duplicate, delete, lock, and hide in vector-editor, including the outliner tree. Use when the user mentions layers, the outliner, selection, paint order, duplicate, delete, lock, hide, or document structure.
disable-model-invocation: true
---

# Document structure

## Start here

Run the cached index instead of re-exploring the codebase (from `vector-editor/`):

```bash
node .cursor/skills/document-structure/scripts/document-structure.mjs           # layers, selection, files, tests, gotchas
node .cursor/skills/document-structure/scripts/document-structure.mjs --check   # verify the cache still matches the code
```

If `--check` reports stale entries, find the moved symbol with Grep, then update `cache` in `scripts/document-structure.mjs`.

Path geometry, modifiers, and SVG serialization belong to the `figure`, `modifiers`, and `svg-io` skills. Command wiring belongs to `editor-command`.

## Core rule

A document is layers plus objects. `Layer.order` is paint depth: a lower order is farther back. The outliner lists `layersFrontToBack`. Objects stay in `document.objects` array order, which is back to front inside a layer; the outliner reverses that list.

Panels dispatch `Command` through `CommandBus`. They do not splice layers or objects themselves.

## Changing structure

1. Put the document edit in `src/app/core/model/` and return the same document when nothing changes.
2. Apply it from `session.service.ts`. After a removal, drop the removed ids in `withoutRemovedObjects` and repair `selectedLayerId` in `reconcileSelectedLayer`.
3. Dispatch the same command from the outliner, options, or keymap.
4. Add a model spec and an outliner spec when the tree behavior changes.
5. Run the test command printed by the script, then `--check`.

## Invariants

- `isInteractionLocked` is true when the object or its layer is locked. Hidden is separate: a hidden object stays in the outliner and can be selected, and `objectsInPaintOrder` omits it.
- `deleteObjects` skips locked objects and objects on a locked layer. `deleteLayer` refuses a locked layer and removes every object on an unlocked layer, including locked children. Both drop boolean modifiers whose operand was removed.
- `duplicateObjects` appends copies named `"<name> copy"`, offset by `DUPLICATE_OFFSET` (24), and selects them. A copied boolean points at the copied operand only when that operand is in the same duplicate set.
- `addLayer` gets `max(order) + 1`, so it is the new front layer, and becomes `selectedLayerId`. `reorderLayer(id, index)` uses the front-to-back visual index: `0` is the front.
- `addPath` returns `null` on a locked or hidden layer.
- Edit mode hides empty points in the outliner and removes them from the object selection.
- `session.select` is a history step (`Select`). `session.selectLayer` is not.
