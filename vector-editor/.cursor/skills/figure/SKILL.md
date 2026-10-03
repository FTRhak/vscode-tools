---
name: figure
description: Adds, changes, or debugs shape (figure) tools in vector-editor - rectangle, ellipse/circle, star, polygon, rhombus - including geometry, the Illustrator-style drag gesture, the size dialog, tool panel entries, and shortcuts. Use when the user mentions figures, shapes, фігури, a new shape tool, or shape drawing behavior.
disable-model-invocation: true
---

# Figure (shape) tools

## Start here

Run the cached index instead of re-exploring the codebase (from `vector-editor/`):

```bash
node .cursor/skills/figure/scripts/figures.mjs           # shapes, model, gesture, files, tests, gotchas
node .cursor/skills/figure/scripts/figures.mjs --check   # verify the cache still matches the code
```

If `--check` reports stale entries, find the moved symbol with Grep, then update `cache` in `scripts/figures.mjs`.

## Core rule

A figure is never its own object type. Every shape is `kind: 'path'` with one closed subpath, so selection, direct select, style, transform, modifiers, outliner, and SVG work with no extra branches. Geometry lives in pure functions in `src/app/core/model/shapes.ts` that return `SourcePath`. Preview and commit use the same function.

## Adding a new shape

1. `shapes.ts`: add the id to `ShapeKind`, `isShapeKind`, and `SHAPE_NAMES`. Build its source in `shapeSourceFromDrag` (drag) and `shapeSource` (dialog) through `closedPath(points, 'line' | 'cubic')`.
2. `command.ts`: add the id to `EditorTool` and `EDITOR_TOOLS_ICONS` (empty string; the icon is an SVG).
3. `editor-tools.ts`: add `{ id, label, shortcut, group: 'Shapes' }` next to the other shapes so it stays in the same group.
4. `keymap.service.ts`: add the key to `toolKeys`.
5. `tool-icon.ts`: add an `@case` with a 16x16 inline SVG.
6. `shape-dialog.ts/.html`: say whether the shape uses box fields (width and height) or radial fields (radius and count).
7. Tests: geometry in `shapes.spec.ts`; the gesture in `viewport.spec.ts` if it behaves differently.
8. Run the test command printed by the script, then `--check`.

## Gesture contract

- One `shape.add` per drag on `pointerup` (one undo step, label `Add shape`).
- Shift: aspect lock or rotation lock. Alt: draw from center. Ctrl or Cmd: star inner radius. Arrow up or down: change the count. Space: move.
- A click (under 4px) opens the numeric dialog. A zero-size drag creates nothing.
- Locked or hidden layers reject the shape (`addShape` returns `null`).
