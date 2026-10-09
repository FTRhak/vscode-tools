---
name: viewport
description: Changes or debugs the vector-editor canvas - camera, pan and zoom, hit-testing, snapping, and pointer gestures for select, direct select, pen, and add point. Use when the user mentions the viewport, canvas, camera, pan, zoom, marquee, snap, hit-test, or a pointer gesture on the artboard.
disable-model-invocation: true
---

# Viewport

## Start here

Run the cached index instead of re-exploring the codebase (from `vector-editor/`):

```bash
node .cursor/skills/viewport/scripts/viewport.mjs           # camera, gestures, snap, files, tests, gotchas
node .cursor/skills/viewport/scripts/viewport.mjs --check   # verify the cache still matches the code
```

If `--check` reports stale entries, find the moved symbol with Grep, then update `cache` in `scripts/viewport.mjs`.

Shape drawing (rectangle, ellipse, star, polygon, rhombus) is owned by the `figure` skill. This skill only routes those tools into `beginShape`.

Pen placement, direct-select drags, and add-point hits are owned by the `path-editing` skill. This skill routes those tools and owns the camera, snap, and hit-testing.

## Core rule

The viewport reads session signals and dispatches `Command` through `CommandBus`. It does not edit the document in place. Camera changes are `session.setViewport` and are not history steps. A drag that changes the document sends `gesture: 'begin'` once, then `'continue'`, and calls `beginClipperHold()` while the pointer is down.

Screen points become document points with `screenToDocument` after subtracting the host bounds. Object-local points use `documentToLocal` / `localToDocument`.

## Pointer routing

`onPointerDown` handles one gesture and returns:

1. Ignore events from `[data-shape-dialog]`.
2. Space + primary, or the middle button, starts pan.
3. Any other non-primary button returns.
4. Route the active tool: `pen`, `add-point`, `empty-point`, `image`, a shape kind, `direct-select`, otherwise `select`.

`onPointerMove` and `onPointerUp` continue the gesture that owns `pointerId`. Capture the pointer on the host and release it when the gesture ends.

## Changing a gesture

1. Keep geometry and command building in `src/app/viewport/utils/`. `Viewport` only tracks pointer state, snap, and dispatch.
2. A click is travel under `GESTURE_THRESHOLD_PX` (4). Past that, select and direct select become a move or a marquee.
3. Object hit-testing walks paint order from the front. Anchor and handle hits are in local path space.
4. Honor locked and hidden layers (`isInteractionLocked`). A blocked object can be selected and does not move.
5. Add or extend a test in the spec next to the behavior, then run the test command printed by the script and `--check`.

## Gesture contract

- Wheel zooms toward the cursor (`zoomAtPoint`) and calls `preventDefault`. Zoom stays in `[MIN_ZOOM, MAX_ZOOM]`.
- A new document id fits the artboard once (`fitArtboard`, padding `ARTBOARD_FIT_PADDING`). Later resizes do not refit.
- Select works in object mode. A click selects; Shift toggles. An empty click clears. A marquee replaces the selection.
- Direct select works in edit mode and does not change the mode. Alt breaks the opposite handle while dragging.
- Add point works in edit mode on the active path. Empty point places only in object mode.
- Space pans only when no shape drag is active. Middle-click pan also suppresses the auxclick autoscroll.
