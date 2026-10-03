---
name: options
description: Changes or debugs the vector-editor Options panel - object transform, visibility, lock, and anchor or handle fields. Use when the user mentions the options panel, object options, anchor options, transform fields, pivot, point type, or numeric edits for the selection.
disable-model-invocation: true
---

# Options panel

## Start here

Run the cached index instead of re-exploring the codebase (from `vector-editor/`):

```bash
node .cursor/skills/options/scripts/options.mjs           # modes, fields, commands, files, tests, gotchas
node .cursor/skills/options/scripts/options.mjs --check   # verify the cache still matches the code
```

If `--check` reports stale entries, find the moved symbol with Grep, then update `cache` in `scripts/options.mjs`.

## Core rule

The panel reads the session and dispatches `Command` through `CommandBus`. It does not edit the document in place. A field commits on blur and Enter, after the draft already holds the typed value. Skip the dispatch when the typed value is not finite or already matches the selection, so a second blur does not add a history step.

`OptionsPanel` shows one body:

1. Object mode with at least one selected object: `object-options`.
2. Otherwise, edit mode with selected anchors on the active object: `anchor-options`.
3. Otherwise: `Nothing selected.`

## Multi-selection

`shared` returns the common value, or `null` when the selected items differ. A `null` number leaves the input empty. A `null` checkbox is indeterminate. A mixed point type shows a disabled `Mixed` option. A commit writes the new value onto every selected id in one command.

## Adding a field

1. Add the key to the draft, `draftFrom`, and the equality function so `linkedSignal` does not reset while the value is unchanged.
2. Bind `[formField]` inside the existing `<label>`. Commit from `(blur)` and `(keydown.enter)`. Enter calls `preventDefault`.
3. Dispatch one existing command for every selected id. Object fields use `object.setFlags`, `object.setTransform`, or `object.setRotationOrigin`. Anchor fields use `path.setAnchor`, `path.setHandle`, `path.setAnchorType`, or `path.translateAnchors`.
4. Keep these components `standalone: false` inside `PanelOptionsModule`.
5. Extend `options-panel.spec.ts`, run the test command printed by the script, then `--check`.

## Field contract

- Name trims and ignores an empty string. It renames every selected object.
- Transform numbers are document values. Pivot is the rotation origin from `rotationOriginDocument`, not `originX` / `originY` raw.
- Apply bakes the active object's transform (`object.applyTransform`). Reset writes the identity transform onto every selected object that is not locked and is not already identity.
- Point type is derived by `anchorPointType`: `corner`, `smooth`, `symmetric`, `line`.
- Setting an anchor position moves its handles by the same delta.
- A handle commit always sends `breakLink: true`. A missing handle needs both X and Y before it is created.
- dX and dY appear only for two or more anchors. They send `path.translateAnchors` with `gesture: 'begin'`. A zero delta does nothing.
