---
name: modifiers
description: Adds, changes, or debugs the non-destructive modifier stack in vector-editor - array, mirror, bevel, round, and boolean - including evaluation, apply, the modifiers panel, and SVG metadata. Use when the user mentions modifiers, the modifier stack, array, mirror, bevel, round, boolean, or Apply.
disable-model-invocation: true
---

# Modifiers

## Start here

Run the cached index instead of re-exploring the codebase (from `vector-editor/`):

```bash
node .cursor/skills/modifiers/scripts/modifiers.mjs           # kinds, stack, commands, files, tests, gotchas
node .cursor/skills/modifiers/scripts/modifiers.mjs --check   # verify the cache still matches the code
```

If `--check` reports stale entries, find the moved symbol with Grep, then update `cache` in `scripts/modifiers.mjs`.

SVG attribute format belongs to the `svg-io` skill. The command catalog belongs to `editor-command`.

## Core rule

A modifier never changes `source` until Apply. The stack on `VectorObject.modifiers` is evaluated in order by `evaluateDocument`. Disabled steps are skipped. Empty points reject every modifier edit and evaluate to no geometry.

`session.service.ts` imports `modifier-edits.ts` directly. The model barrel does not re-export it.

## Adding or changing a modifier

1. Add the variant to `Modifier` in `types.ts`, then to `ModifierKind` and `ModifierPatch` in `modifier-edits.ts`.
2. Give it a default in `defaultModifier`. Clamp writes in `patchModifier` and return the same modifier when nothing changes.
3. Apply it in `walkStack` inside `evaluate.ts`. Push a diagnostic and leave the current source when the step cannot run.
4. Bevel and boolean go through Clipper. Record their output in `captureClipperHold` so a drag can freeze that step. Array, mirror, and round stay live during a hold.
5. Persist a new field in `modifierPayload` (`svg-export.ts`) and `readModifier` (`svg-import.ts`). Boolean operands and mirror centers are object indexes in `optimized` mode.
6. Add a field component under `panels/modifiers`. It emits a patch; `ModifierRow` sends `modifier.update`. Register the component in `modifiers.module.ts`.
7. Extend `evaluate.spec.ts`. Run the test command printed by the script, then `--check`.

## Stack contract

- Order is the array order. Later steps see the output of earlier enabled steps.
- `modifier.apply` bakes the prefix through that modifier with `remintSource` and keeps the modifiers after it. `modifier.applyAll` bakes the whole stack and clears it.
- A boolean that runs sets the evaluated `fillRule` to `evenodd`. Apply copies that fill rule onto the object style.
- Apply clears anchor and segment selection when the baked object is the active object.
- Boolean needs two different closed paths, an invertible transform, and no operand cycle. Mirror can use bounds or an empty-point center. Bevel distance `0` is a no-op.
