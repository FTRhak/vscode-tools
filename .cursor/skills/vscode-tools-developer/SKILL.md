---
name: vscode-tools-developer
description: Develop the vscode-tools VS Code extension — Explorer schematics menus, Angular/Nx generator webviews, form elements, webpack bundling, F5 debug, and tests. Use when adding commands, generators, form fields, menus, webviews, or changing this extension.
---

# vscode-tools Developer

VS Code extension (`publisher: FTRhak`, `name: vscode-tools`) that adds an Explorer context submenu **Schematics Tools → Angular | React**. Angular items open a webview form, then run an `nx g @nx/angular:*` command in a terminal. React Generate Component opens a webview, then writes files from templates.

Treat `vsc-extension-quickstart.md` as leftover Yeoman template, not current architecture. Details: [quickstart.md](quickstart.md). Full map: [reference.md](reference.md).

## Source map

| Path | Role |
|------|------|
| `package.json` | Manifest: commands, submenus, menus. `main` is `./dist/extension.js` |
| `src/extension.ts` | `activate` / `deactivate`. Registers React placeholders + `angularCommands()` + `reactCommands()` |
| `src/angular.ts` | Aggregates Angular generator modules |
| `src/angular/generate-*.ts` | One file per generator: path resolve → webview → CLI → terminal |
| `src/react.ts` | Aggregates React generator modules |
| `src/react/generate-*.ts` | One file per generator: path resolve → webview → write template files |
| `src/react/component-generation.ts` | React component path/name plan (no vscode) |
| `src/react/templates/` | String templates for generated React files |
| `src/angular/commands.ts` | Empty. Do not assume it registers anything |
| `src/form_elements/` | HTML string factories. Re-export from `index.ts` |
| `src/form_elements/base_elements/` | `TextElement`, `SelectElement`, `BooleanElement` |
| `src/styles/styles.css` | Webview CSS. Webpack copies to `dist/media/` |
| `src/test/extension.test.ts` | Sample test |
| `src/test/react-component-generation.test.ts` | React component file-plan tests |

Angular command IDs use prefix `vscode-angular.*`. React generate commands use `vscode-react.*`.

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

## Add a React generator

Copy this checklist:

```
- [ ] package.json contributes.commands (`vscode-react.createReact<Kind>`)
- [ ] package.json menus.schematicsReactSubmenu
- [ ] src/react/generate-<kind>.ts
- [ ] src/react.ts concat
- [ ] form fields from src/form_elements
- [ ] hidden input command name matches onDidReceiveMessage
- [ ] templates under src/react/templates when writing files
```

1. Declare the command in `package.json` (`vscode-react.createReact<Kind>`, title `Generate <Kind>`).
2. Add it under `menus.schematicsReactSubmenu` with `"group": "react"`.
3. Create `src/react/generate-<kind>.ts` using `generate-component.ts` as the template: Explorer path → webview → write files. Do not run nx/ng unless asked.
4. Export a function that returns `vscode.Disposable[]` and concat it in `src/react.ts`.
5. Reuse form elements. Add a new element only if no existing one covers the field.

## Shared generator contract

Every current generator does this:

1. Explorer `resource: vscode.Uri` → if not a directory, use `path.dirname`.
2. Path shown in the form is workspace-relative (`path.relative(workspaceFolder.uri.fsPath, absolutePath)`).
3. `createWebviewPanel` with `enableScripts: true`.
4. HTML is a string. CSS via `panel.webview.asWebviewUri` on `dist/media/styles.css`.
5. Hidden input `name="command"` (e.g. `angular-create-component`). Form `submit` → `FormData` → `vscode.postMessage`.
6. **Angular:** Extension builds a shell string. Default is `echo "Error Command"`. `type === 'nx'` is implemented. `type === 'ng'` is empty — do not pretend `ng` works.
7. **Angular name:** `message.name.split(/(?=[A-Z])/).join('_').toLowerCase()`.
8. **Angular:** Run via `createTerminal("Generation Terminal")` + `sendText` + `show`.
9. **React component:** PascalCase name; write `{Name}.tsx`, optional `{Name}.{css|scss|sass|less}` unless `skip_style` or style `none`, optional `{Name}.test.tsx` / `index.ts` / `{Name}.props.ts`. Do not open a generation terminal.

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
        ├── schematicsAngularSubmenu — application, class, component, config, directive, environment, guard, interceptor, library, pipe, module, resolver, service, service-worker, web-worker
        └── schematicsReactSubmenu — Generate Component; placeholders openFileInfo, openInTerminal
```

React Generate Component writes files from templates (`vscode-react.createReactComponent`). Remaining React items are stubs (`showInformationMessage` / terminal `ls`).

## Build, debug, test

- **F5** → `.vscode/launch.json` `Run Extension` → default build task `npm watch` (webpack) → Extension Development Host. Output is `dist/`.
- Reload Host with `Ctrl+R` / `Cmd+R` after rebuild. Breakpoints in `src/*.ts` (source maps).
- Scripts: `compile`, `watch`, `package` (production + hidden-source-map), `lint`, `pretest`, `test`.
- Webpack: entry `src/extension.ts` → `dist/extension.js` (`commonjs2`). `vscode` is external. `CopyPlugin` copies `src/styles` → `dist/media`.
- Tests: `*.test.ts` under `src/test`. `watch-tests` compiles to `out/`. React component planning is covered in `react-component-generation.test.ts`.
- Recommended extensions: `amodio.tsl-problem-matcher`, `ms-vscode.extension-test-runner`, `dbaeumer.vscode-eslint`.
- `.vscodeignore` excludes `src/`, webpack, tsconfig, eslint, quickstart. Packaged payload is `package.json` + `dist/`.

## Conventions

- Match existing generator files; do not extract a shared helper unless asked.
- Keep webview class `vscode-angular` and existing CSS classes.
- Angular commands stay `vscode-angular.*`. React generate commands use `vscode-react.*`.
- `activationEvents` is `[]`; contributed commands still activate the extension. Do not add `*` activation.
- ESLint warns: `curly`, `eqeqeq`, `semi`, import naming camelCase/PascalCase.

## Known gaps (do not "fix" unless asked)

- Application webview title/heading still say "pipe".
- `ng` CLI branch is unimplemented.
- Application handler computes unused `in_folder` / `sufix`.
- React submenu still has placeholder `openFileInfo` / `openInTerminal`.
- Tests do not cover commands or webviews.
- `SelectElement` does not mark the selected option from its `value` argument.
