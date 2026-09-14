---
name: vscode-tools-developer
description: Develop the vscode-tools VS Code extension — Explorer schematics menus, Angular/Nx generator webviews, form elements, webpack bundling, F5 debug, and tests. Use when adding commands, generators, form fields, menus, webviews, or changing this extension.
---

# vscode-tools Developer

VS Code extension (`publisher: FTRhak`, `name: vscode-tools`) that adds an Explorer context submenu **Schematics Tools → Angular | React**. Angular items open a webview form, then run an `nx g @nx/angular:*` command in a terminal.

Treat `vsc-extension-quickstart.md` as leftover Yeoman template, not current architecture. Details: [quickstart.md](quickstart.md). Full map: [reference.md](reference.md).

## Source map

| Path | Role |
|------|------|
| `package.json` | Manifest: commands, submenus, menus. `main` is `./dist/extension.js` |
| `src/extension.ts` | `activate` / `deactivate`. Registers React placeholders + `angularCommands()` |
| `src/angular.ts` | Aggregates Angular generator modules |
| `src/angular/generate-*.ts` | One file per generator: path resolve → webview → CLI → terminal |
| `src/angular/commands.ts` | Empty. Do not assume it registers anything |
| `src/form_elements/` | HTML string factories. Re-export from `index.ts` |
| `src/form_elements/base_elements/` | `TextElement`, `SelectElement`, `BooleanElement` |
| `src/styles/styles.css` | Webview CSS. Webpack copies to `dist/media/` |
| `src/test/extension.test.ts` | Sample test only |

Command IDs use prefix `vscode-angular.*` (not `vscode-tools.*`). Keep that unless the user asks to rename.

## Add an Angular generator

Copy this checklist:

```
- [ ] package.json contributes.commands
- [ ] package.json menus.schematicsAngularSubmenu
- [ ] src/angular/generate-<kind>.ts
- [ ] src/angular.ts concat
- [ ] form fields from src/form_elements
- [ ] hidden input command name matches onDidReceiveMessage
```

1. Declare the command in `package.json` `contributes.commands` (`vscode-angular.createAngular<Kind>`, title `Generate <Kind>`).
2. Add it under `menus.schematicsAngularSubmenu` with `"group": "angular"`.
3. Create `src/angular/generate-<kind>.ts` using the existing generate files as the template. Do not invent a new webview/message/CLI shape.
4. Export a function that returns `vscode.Disposable[]` and concat it in `src/angular.ts`.
5. Reuse form elements. Add a new element only if no existing one covers the field.

## Shared generator contract

Every current generator does this:

1. Explorer `resource: vscode.Uri` → if not a directory, use `path.dirname`.
2. Path shown in the form is workspace-relative (`path.relative(workspaceFolder.uri.fsPath, absolutePath)`).
3. `createWebviewPanel` with `enableScripts: true`.
4. HTML is a string. CSS via `panel.webview.asWebviewUri` on `dist/media/styles.css`.
5. Hidden input `name="command"` (e.g. `angular-create-component`). Form `submit` → `FormData` → `vscode.postMessage`.
6. Extension builds a shell string. Default is `echo "Error Command"`. `type === 'nx'` is implemented. `type === 'ng'` is empty — do not pretend `ng` works.
7. Name: `message.name.split(/(?=[A-Z])/).join('_').toLowerCase()`.
8. Run via `createTerminal("Generation Terminal")` + `sendText` + `show`.

Unchecked checkboxes are **absent** from `FormData`. Use `!!message.<field>`.

**Standalone inversion (keep):** checkbox `standalone` checked → append `--standalone=false`.

Path shape (component / directive / pipe):

```
${path}/${in_folder ? (name + '/') : ''}${name}${sufix ? '.<kind>' : ''}
```

Application is different: only `${path}/${in_folder ? (name + '/') : ''}` plus `--skipTests` / `--style` / `--prefix`. Application form has no in-folder or suffix fields today.

## Form elements

Compose webview HTML from factories in `src/form_elements`. Do not inline raw inputs unless adding a new primitive. Do not read those files for composition — use the **form-elements** skill (catalog, signatures, FormData names, which generators render which fields).

New boolean/text/select fields: wrap a base element, export from `index.ts`, and update the form-elements skill.

## Menus

```
explorer/context
  └── schematicsSubmenu ("Schematics Tools")
        ├── schematicsAngularSubmenu — application, class, component, directive, environment, interceptor, library, pipe, module, service
        └── schematicsReactSubmenu — placeholders openFileInfo, openInTerminal
```

React commands are stubs (`showInformationMessage` / terminal `ls`). Implement React generators in the same Explorer → webview → CLI pattern, under `vscode-angular.*` unless renaming.

## Build, debug, test

- **F5** → `.vscode/launch.json` `Run Extension` → default build task `npm watch` (webpack) → Extension Development Host. Output is `dist/`.
- Reload Host with `Ctrl+R` / `Cmd+R` after rebuild. Breakpoints in `src/*.ts` (source maps).
- Scripts: `compile`, `watch`, `package` (production + hidden-source-map), `lint`, `pretest`, `test`.
- Webpack: entry `src/extension.ts` → `dist/extension.js` (`commonjs2`). `vscode` is external. `CopyPlugin` copies `src/styles` → `dist/media`.
- Tests: `*.test.ts` only. `watch-tests` compiles to `out/`. Current suite is the template sample — add real tests next to behavior you change.
- Recommended extensions: `amodio.tsl-problem-matcher`, `ms-vscode.extension-test-runner`, `dbaeumer.vscode-eslint`.
- `.vscodeignore` excludes `src/`, webpack, tsconfig, eslint, quickstart. Packaged payload is `package.json` + `dist/`.

## Conventions

- Match existing generator files; do not extract a shared helper unless asked.
- Keep webview class `vscode-angular` and existing CSS classes.
- Do not introduce a new command-ID prefix.
- `activationEvents` is `[]`; contributed commands still activate the extension. Do not add `*` activation.
- ESLint warns: `curly`, `eqeqeq`, `semi`, import naming camelCase/PascalCase.

## Known gaps (do not "fix" unless asked)

- Application webview title/heading still say "pipe".
- `ng` CLI branch is unimplemented.
- Application handler computes unused `in_folder` / `sufix`.
- React submenu is placeholder.
- Tests do not cover commands or webviews.
- `SelectElement` does not mark the selected option from its `value` argument.
