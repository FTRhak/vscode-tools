# vsc-extension-quickstart.md investigation

`vsc-extension-quickstart.md` is the stock Yeoman / `yo code` TypeScript + webpack template. It was not updated after this repo became a schematics extension. Use it for F5 / test-runner mechanics only.

## What the template describes

1. **Manifest + one command** — `package.json` declares a command so the Command Palette can show it without loading the extension. `src/extension.ts` exports `activate`, which registers the implementation on first activation.
2. **Setup** — install `amodio.tsl-problem-matcher`, `ms-vscode.extension-test-runner`, `dbaeumer.vscode-eslint` (still listed in `.vscode/extensions.json`).
3. **Run** — F5 opens an Extension Development Host. Palette command was **Hello World**. Breakpoints in `src/extension.ts`; logs in Debug Console.
4. **Reload** — debug toolbar relaunch, or `Ctrl+R` / `Cmd+R` in the Host.
5. **API** — `node_modules/@types/vscode/index.d.ts`.
6. **Tests** — Extension Test Runner; run the **watch** task or tests are not discovered; Testing view or `Ctrl/Cmd+; A`; files must match `**.test.ts` under `src/test`.
7. **Go further** — bundle, publish, CI. Bundling is already done (webpack + `main: ./dist/extension.js`).

## What is still true

- `activate` / `deactivate` entry in `src/extension.ts`.
- Commands in `package.json` `contributes.commands` appear before JS loads.
- F5 + `preLaunchTask` webpack watch + Host window.
- `Ctrl+R` reload after rebuild.
- Test runner + `*.test.ts` + `out/` from `watch-tests`.
- Recommended extensions unchanged.

## What is stale (do not follow)

| Quickstart | This repo |
|------------|-----------|
| One Hello World command | Six `vscode-angular.*` commands; no Hello World |
| Activate by running that command | Activate via Explorer context commands (empty `activationEvents`) |
| Implementation lives only in `extension.ts` | `extension.ts` is a thin registrar; logic is in `src/angular/` + `form_elements/` |
| Palette-first workflow | Primary UX is Explorer → Schematics Tools submenu → webview |
| "Consider bundling" | Already bundled; CSS copied to `dist/media` |
| Sample is the product | Sample test and React menu titles (`__Open File Info__`) are leftovers |

Hello World is gone. Palette titles that remain are the Generate * commands and the two React placeholders.

## Activation

Template implied `onCommand:`. This package uses `"activationEvents": []`. VS Code still activates on contributed commands. Do not add `"*"` or restore Hello World activation.

## Debug vs test outputs

- Extension Host loads **webpack** output: `dist/extension.js`.
- Tests compile with **tsc** to `out/` (`compile-tests` / `watch-tests`).
- Quickstart "watch task" for test discovery is `npm: watch-tests` (and the composite `tasks: watch-tests`). F5's default task is `npm watch` (extension bundle), which is not the test compiler.

## Ignore vs ship

`.vscodeignore` excludes `vsc-extension-quickstart.md`, `src/`, webpack, and tsconfig. Marketplace package is `package.json` + `dist/`.

## Practical rule

When changing this extension, copy `src/angular/generate-component.ts` and `package.json` menus — not the Hello World story in the quickstart.
