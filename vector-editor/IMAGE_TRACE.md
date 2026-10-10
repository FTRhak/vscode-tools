# Image Trace: Contributor Guide

This document maps the current Image to vector implementation and the contracts
to preserve when changing it. The feature is a non-destructive image modifier:
the source image stays on the document until Apply, while traced regions are
stored on the modifier and reused for preview and export.

## Architecture at a glance

```text
ModifiersPanel / ModifierRow
        │ traceImageContent(image, settings)
        ▼
viewport/utils/trace-image.ts       browser image → bounded RGBA raster
        │ traceRaster(raster)
        ▼
core/model/image-trace.ts           RGBA → color regions with SourcePaths
        │ modifier.add / modifier.update
        ▼
VectorObject.image + Modifier[type=trace]
        ├── sceneFromDocument → viewport preview
        ├── SVG exporter → traced vector appearance + editable metadata
        └── modifier.apply → expandTrace → replace image with filled paths
```

Core model code owns deterministic raster-to-path conversion and trace data
validation. Browser APIs belong in the viewport adapter. The panel dispatches
commands; it does not mutate document state directly.

## Important files

| Responsibility | Source |
| --- | --- |
| Trace modifier and region types | [src/app/core/model/types.ts](src/app/core/model/types.ts) |
| Defaults, presets, raster algorithm, diagnostics, preview conversion | [src/app/core/model/image-trace.ts](src/app/core/model/image-trace.ts) |
| Browser image decoding, sizing, canvas readback | [src/app/viewport/utils/trace-image.ts](src/app/viewport/utils/trace-image.ts) |
| Panel add/reorder/apply-all actions | [src/app/panels/modifiers/components/modifiers-panel/modifiers-panel.ts](src/app/panels/modifiers/components/modifiers-panel/modifiers-panel.ts) |
| Trace controls and form drafts | [src/app/panels/modifiers/components/trace-modifier-fields/trace-modifier-fields.ts](src/app/panels/modifiers/components/trace-modifier-fields/trace-modifier-fields.ts), [trace-modifier-fields.html](src/app/panels/modifiers/components/trace-modifier-fields/trace-modifier-fields.html) |
| Retrace requests and modifier commands | [src/app/panels/modifiers/components/modifier-row/modifier-row.ts](src/app/panels/modifiers/components/modifier-row/modifier-row.ts) |
| Add/update validation and settings normalization | [src/app/core/model/modifier-edits.ts](src/app/core/model/modifier-edits.ts) |
| Image preview scene and SVG rendering | [src/app/viewport/utils/scene.ts](src/app/viewport/utils/scene.ts), [src/app/viewport/components/viewport/viewport.html](src/app/viewport/components/viewport/viewport.html) |
| Apply to editable paths | [src/app/core/model/expand-trace.ts](src/app/core/model/expand-trace.ts), [src/app/core/session.service.ts](src/app/core/session.service.ts) |
| SVG serialization and restoration | [src/app/core/io/svg-export.ts](src/app/core/io/svg-export.ts), [src/app/core/io/svg-import.ts](src/app/core/io/svg-import.ts) |
| Algorithm and round-trip tests | [src/app/core/model/image-trace.spec.ts](src/app/core/model/image-trace.spec.ts), [src/app/core/io/svg-io.spec.ts](src/app/core/io/svg-io.spec.ts) |

## Data model and invariants

A trace modifier is one variant in the `Modifier` union. It stores:

- `mode`, `colors`, `threshold`, `paths`, `corners`, `noise`, and `ignoreWhite`:
  the settings used for the most recent trace.
- `regions`: ordered `{ fill, source }` results. Each source is a vector
  `SourcePath`, not a raster mask.
- `view`: `result`, `outlines`, or `source`; this changes presentation, not the
  stored trace.
- Optional `fault: 'unread'` when the image could not be decoded.
- `enabled`, like other modifiers.

Images accept at most one trace modifier and reject other modifier kinds.
Non-image paths reject trace. These checks are in `modifier-edits.ts`; keep
them consistent with the panel's image-specific add menu. Trace is deliberately
not an evaluator geometry step: image evaluation returns no vector subpaths,
and the `trace` case in `walkStack` does not retrace or modify geometry.

`defaultTraceSettings` is the source of truth for first-run values and is used
when adding the modifier. The current bounds enforced by `clampTraceSettings`
are colors 2–30, threshold 0–255, paths/corners/noise 0–100, with integer
values. The UI's presets are defined alongside those defaults in
`image-trace.ts`; the preset select compares all settings except `view`.

## End-to-end behavior

### Adding and re-tracing

1. The panel exposes only **Image to vector** for an image. It calls
   `traceImageContent` with the defaults before dispatching `modifier.add`.
   If the active image changes while the initial trace is running, it discards
   that result.
2. `traceImageContent` requires available pixel content in `image.dataUrl`. It rasterizes in the
   browser and passes the RGBA data, image frame dimensions, and settings to
   the pure `traceRaster` function.
3. Editing mode or a raster setting in the row retraces the image and dispatches
   one `modifier.update` containing the new settings, regions, and fault state.
   The row's serial counter prevents an older overlapping retrace from
   overwriting a newer one.
4. Changing only `view` dispatches a small patch and does not retrace.
   Preset and number-field edits emit patches through `TraceModifierFields`;
   number drafts are committed on blur or Enter.

The adapter maps decode/readback failures to `fault: 'unread'`. A valid decode
with no regions has no fault and is diagnosed as “Image to vector has no
result.” An image without embedded pixels is diagnosed separately. Diagnostics
are only reported for an enabled trace.

### Rasterization and vectorization

`traceImageContent` uses `createImageBitmap` and a canvas with
`willReadFrequently`. Its raster dimensions are scaled so the longest edge is
at most `TRACE_SAMPLE_LIMIT` (currently 384). With `preserveAspectRatio:
'none'`, the bitmap is stretched to the frame; otherwise it is fitted inside
the frame and centered, leaving transparent pixels as needed. The pure model
also guards input dimensions and downsamples direct raster inputs above the
same edge limit.

`traceRaster` performs these stages:

1. Clamp settings and downsample if necessary.
2. Assign each visible pixel to a palette label:
   - `color`: median-cut palette splitting by the RGB channel with the largest
     range, up to the requested color count.
   - `colorDistance`: starts with the most frequent visible RGB color, then
     repeatedly selects the distinct sampled color farthest from the existing
     palette by minimum squared RGB distance. Pixels are assigned to their
     nearest selected palette color. The palette contains up to the requested
     number of colors.
   - `grayscale`: luminance bins, with each output gray based on its bin's
     average tone.
   - `blackAndWhite`: luminance compared with `threshold`; `colors` is not used.
   Pixels with alpha below 128 are transparent.
3. Optionally remove near-white palette colors (`ignoreWhite` means all RGB
   channels are at least 250).
4. Absorb four-connected, same-label components smaller than `noise` into
   neighboring labels by majority vote. The cutoff is a sampled-raster pixel
   count, not a percentage.
5. Walk each label's pixel boundaries into closed loops. Regions are ordered by
   descending pixel count, then by label.
6. Drop collinear points and apply closed-loop Ramer–Douglas–Peucker
   simplification in sampled-raster coordinates. Its tolerance is
   `1.5 * (100 - paths) / 100`, so higher `paths` preserves more contour points.
7. Round contour corners with cubic Bézier arcs, then scale the result into the
   image frame. The requested corner radius is 0.5–2.5 sampled pixels and is
   capped to avoid consuming too much of a short edge. Higher `corners`
   increases the rounding radius.

Regions can contain multiple closed subpaths, including nested boundaries
needed to represent holes. Preview and baked paths use the even-odd fill rule
so holes render correctly. Keep this topology when changing contour extraction.

### Preview and evaluation

`enabledTrace` and `tracePreview` turn stored regions into SVG path data for
`sceneFromDocument`. In `result` view the paths are filled with their palette
colors; `outlines` draws each path's fill color as a stroke. `source` view,
disabled traces, and empty results fall back to the original image. The viewport
does not recompute the trace during rendering.

The general evaluator still handles diagnostics, but it does not turn image
trace into ordinary path geometry. This split is intentional: preview is
derived from the stored `regions`, and repeated scene evaluation remains cheap
and deterministic.

### Apply

Applying a trace is a special case in `applyModifierCommand`: it calls
`expandTrace` before the regular modifier baking path. For each region,
`expandTrace` creates a path object with the image's layer, visibility, lock
state, and transform; it copies the region fill, uses no stroke, applies the
even-odd fill rule, and remints path IDs. It replaces the image with those paths
and selects the new objects. If there are no regions, the image remains and no
new objects are selected.

Do not route trace Apply through `evaluateObjectPrefix`: the trace result is
already stored as regions and the image's evaluator geometry is empty.

## SVG persistence and export

The SVG exporter has two related responsibilities:

- For a traced image with regions, its visible SVG representation is vector
  paths, not an `<image>` element.
- In `all` and `optimized` modes, editor metadata preserves the image and its
  trace settings, view, fault (if present), and regions. Optimized region
  sources use indexed anchor/segment references. Import validates the trace
  settings, fill colors, and non-empty sources, then claims fresh IDs for
  restored paths.
- `minimal` mode drops editor metadata and exports the visual paths as ordinary
  vector objects; it is an interchange/export result, not an editable trace.

When adding a trace field, update both `modifierPayload` in `svg-export.ts` and
the trace branch in `readModifier` in `svg-import.ts`, including defaults and
validation. Extend the SVG round-trip test for `all` and `optimized`, and verify
that `minimal` still has the expected appearance without metadata.

## Changing the feature

| Change | Touch points |
| --- | --- |
| Add or adjust a setting/default/preset | `TraceSettings`, `defaultTraceSettings`, `tracePresets`, `clampTraceSettings` in `image-trace.ts`; `TraceModifier` and `ModifierPatch`; trace fields/template; retrace patch construction in `ModifierRow`; SVG read/write; tests. |
| Change quantization, noise, contours, or curve fitting | `traceRaster` and its private helpers in `image-trace.ts`; add focused deterministic raster tests in `image-trace.spec.ts`. Preserve alpha behavior, stable region ordering, holes, and frame-space coordinates. |
| Change decode, image sizing, or aspect-ratio behavior | `traceImageContent` / `rasterizeFrame` in `viewport/utils/trace-image.ts`; verify embedded-image handling, frame dimensions, transparency, and failure mapping. |
| Change controls or previews | `TraceModifierFields` and its template for control state; `ModifierRow` for commit/retrace semantics; `scene.ts` and the viewport template for preview rendering. Keep view-only changes from starting a raster trace. |
| Change Apply or output path properties | `expand-trace.ts`, the `applyModifierCommand` branch in `session.service.ts`, and command/session tests. Preserve transform, layer, visibility/lock state, unique IDs, fill, and even-odd holes. |
| Change persistence/export | `svg-export.ts` and `svg-import.ts`; cover all three export modes in `svg-io.spec.ts`. |

After changing the `Modifier` union, also check every exhaustive modifier
switch. `modifier-edits.ts` is imported directly by `session.service.ts` and is
not re-exported from the model barrel. The modifiers feature's current target
test set is printed by
`node .cursor/skills/modifiers/scripts/modifiers.mjs`.

## Useful invariants for tests

- Re-tracing replaces stored regions; changing view does not.
- An older overlapping trace request must not overwrite the newest result.
- Result and outline previews use stored region geometry; source view shows the
  original raster.
- Alpha below 128 is not traced; ignored near-white regions are absent.
- Small four-connected components are removed according to `noise`.
- Holes remain subpaths and render with even-odd fill.
- Invalid dimensions or undersized RGBA input produce no regions.
- Apply replaces one image with one path per region and preserves image-level
  placement state.
- `all`/`optimized` preserve editable trace metadata; `minimal` preserves only
  the vector appearance.
