---
name: path-editing
description: Adds, changes, or debugs path editing in vector-editor - the pen, direct select, and add-point tools, anchors, handles, segments, and point types. Use when the user mentions the pen, direct select, add point, anchors, handles, path points, or closing a path.
disable-model-invocation: true
---

# Path editing

## Start here

Run the cached index instead of re-exploring the codebase (from `vector-editor/`):

```bash
node .cursor/skills/path-editing/scripts/path-editing.mjs           # tools, model, gestures, files, tests, gotchas
node .cursor/skills/path-editing/scripts/path-editing.mjs --check   # verify the cache still matches the code
```

If `--check` reports stale entries, find the moved symbol with Grep, then update `cache` in `scripts/path-editing.mjs`.

Camera, snap, and pointer routing belong to the `viewport` skill. The command catalog belongs to `editor-command`.

## Core rule

A drawn stroke is `kind: 'path'`. The pen writes one open subpath; closing it adds the return segment. Anchors and handles stay in path-local space. Geometry lives in `pen-path.ts` and `edit-path.ts`. The viewport and the options panel only build `Command` values and dispatch them.

`session.service.ts` imports `pen-path.ts` directly. The model barrel exports `edit-path` and does not re-export the pen functions.

## Changing path editing

1. Put the geometry in `pen-path.ts` (placing and closing a stroke) or `edit-path.ts` (move, handles, point type, insert, delete). Return the same source when nothing changes.
2. Add a `Command` only when none of `pen.*` or `path.*` already carries the change. Handle it in `applySessionCommand`, then add a `historyLabel` case.
3. A drag sends `gesture: 'begin'` once and `'continue'` after that. Extend `gestureContinues` so the drag is one undo step.
4. Keep hit-testing and command building in `src/app/viewport/utils/tools/`. `Viewport` tracks the pointer, snaps, and dispatches.
5. Numeric anchor edits go through `anchor-options` as `path.setAnchor`, `path.setHandle`, or `path.setAnchorType`.
6. Add or extend the spec next to the behavior, run the test command printed by the script, then `--check`.

## Gesture contract

- Pen (`P`): object mode starts `pen.begin`. Edit mode appends to the open active path. A drag past 4px sends `pen.setHandles`; Alt breaks the handle link. Clicking the first anchor closes the path when it already has two or more anchors.
- Enter on the canvas finishes the open stroke without recording history. Escape undoes the last pen step.
- Direct select (`A`) works in edit mode and does not change the mode. Shift adds to the anchor selection. A drag moves anchors or one handle. Alt keeps the opposite handle. An empty click clears anchors. A marquee replaces, or adds with Shift.
- Add point (`+` or `=`) inserts once on the active path in edit mode. Endpoint hits are rejected.
- Delete or `X` in edit mode sends `path.deleteAnchors` for the selected anchors.
- Keys `1` and `2` set `editSelectionKind` to `anchor` or `segment`. No gesture writes `selectedSegmentIds`.
