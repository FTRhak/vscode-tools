---
name: editor-command
description: Maps vector-editor commands to session handlers, history labels, and tests. Use when adding or changing a Command, CommandBus dispatch, history label, undo step, or session command handler, or when the user mentions editor-command, commands, or history.
disable-model-invocation: true
---

# Editor commands

## Start here

Run the catalog from `vector-editor/`:

```bash
node .cursor/skills/editor-command/scripts/editor-command.mjs
node .cursor/skills/editor-command/scripts/editor-command.mjs --check
node .cursor/skills/editor-command/scripts/editor-command.mjs --json
```

`--check` fails when a `Command` type has no session handler, no `historyLabel` case, no cache entry, or no test. A command that no `*.spec.ts` dispatches needs an `untested` reason in the script.

When `--check` reports a stale symbol, update `cache` in `scripts/editor-command.mjs`.

## Core rule

UI code dispatches a `Command` through `CommandBus`. `SessionService.apply` calls `commitSession`. Document edits go through `applySessionCommand`. A component does not change the document itself.

`history.undo`, `history.redo`, and `history.jump` are applied in `commitSession` and return `null` from `historyLabel`.

## Adding a command

1. Add the variant to `Command` in `src/app/commands/models/command.ts`.
2. Handle it in `applySessionCommand` in `src/app/core/session.service.ts`. Keep history navigation in `commitSession`.
3. Add a `historyLabel` case in `src/app/commands/models/history.ts`. Return `null` only for session chrome and history navigation.
4. When a drag must be one undo step, extend `gestureContinues` and add the type to `cache.coalesce`.
5. Dispatch it with `bus.dispatch`. Add a case in `src/app/commands/services/command-bus.service.spec.ts`, or set `cache.untested[type]` to why there is no command test.
6. Add the type to `cache.commands` with `handler` and `history`.
7. Run `--check`, then the test command printed by the script.

## History rules

- A labeled command that leaves `document`, `mode`, and `selection` unchanged is not recorded.
- `gesture: 'continue'` extends the open entry when its label matches. `gesture: 'begin'` starts a new entry.
- `object.setFlags` and `layer.update` return `null` when `name`, `visible`, and `locked` are all omitted.
- `pen.finish` records `Close path` only when `closed` is true. `pen.begin`, `pen.addPoint`, and `pen.setHandles` share the label `Pen`.
