---
name: svg-io
description: Changes or debugs SVG import and export in vector-editor, including save modes (all, optimized, minimal), data-vector-editor metadata, path data, primitives, transforms, gradients, and round-trip tests. Use when the user mentions SVG, import, export, save modes, or data-vector-editor attributes.
disable-model-invocation: true
---

# SVG import and export

## Start here

Run the cached index instead of re-exploring the codebase (from `vector-editor/`):

```bash
node .cursor/skills/svg-io/scripts/svg-io.mjs           # modes, attributes, files, tests, gotchas
node .cursor/skills/svg-io/scripts/svg-io.mjs --check   # verify the cache still matches the code
```

If `--check` reports stale entries, find the moved symbol with Grep, then update `cache` in `scripts/svg-io.mjs`.

## Core rule

The file is SVG. Visible markup (`d`, fill, stroke, groups) is the presentation. Editor state lives in `data-vector-editor*` JSON. When that payload is present, import restores `source` and `transform` from it and ignores the baked `d`. A foreign SVG has no payload: its primitives become `SourcePath` and transforms are baked into anchors.

## Save modes

- `all`: ids, locks, swatches, source ids, and modifier objects as stored.
- `optimized`: names and geometry without ids, locks, or swatches. Segment ends are anchor indexes. Boolean operands and mirror centers are indexes into export order.
- `minimal`: evaluated visible paths only. No editor attributes. Empty points are omitted. Import puts them on one layer. Visible images stay as `<image>`.

`all` serializes each modifier object. `optimized` builds an explicit payload in `modifierPayload`, so a new modifier field must be added there and read back in `readModifier`.

## Changing the format

1. Prefer an additive field with a default. Bump `formatVersion` only when an older file cannot be read.
2. Write the field in `svg-export.ts` for every mode that should keep it.
3. Read it in `svg-import.ts`. Missing fields use the same default an old file needs.
4. Id references in `optimized` become indexes into export order: layers back to front, then objects whose layer id is unknown.
5. Add a round-trip in `svg-io.spec.ts` for each affected mode.
6. Run the test command printed by the script, then `--check`.

## Import contract

- `importSvg` returns `{ ok: false }` for empty text, a parser error, or a root that is not `svg`.
- `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, and `polygon` become paths. `Q`, `T`, and `A` are stored as cubics.
- A top-level `g` or nested `svg` is a layer. Groups inside a layer stay on that layer.
- `text`, `use`, `foreignObject`, filters, clips, masks, patterns, symbols, scripts, and styles increment `skipped`. A readable `<image>` becomes `kind: 'image'`. Remote URLs, `..` paths, and skewed transforms still increment `skipped`. `title`, `desc`, and `metadata` do not.
- `linearGradient` and `radialGradient` in `defs` become document gradients. A fill of `url(#id)` is kept as that string.
- `FileActions` dispatches `document.replace` after a successful import and downloads `exportSvg` from the save dialog.
