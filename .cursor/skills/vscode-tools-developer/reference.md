# vscode-tools reference

## Runtime flow

```
Explorer right-click
  → package.json menus (submenu chain)
  → registered command (vscode-angular.*)
  → activate() if first use
  → resolve folder from Uri
  → WebviewPanel + HTML form
  → postMessage({ command, ...fields })
  → build nx g @nx/angular:<kind> ...
  → Terminal "Generation Terminal"
```

`activate` in `src/extension.ts` always registers:

- `vscode-angular.openFileInfo` — info toast with `resource.fsPath`
- `vscode-angular.openInTerminal` — terminal named "Explorer Terminal", sends `ls` (resource unused)
- everything from `angularCommands(context)`

`deactivate` is empty.

## Manifest commands

| Command ID | Title | Menu |
|------------|-------|------|
| `vscode-angular.createAngularApplication` | Generate Application | Angular |
| `vscode-angular.createAngularComponent` | Generate Component | Angular |
| `vscode-angular.createAngularDirective` | Generate Directive | Angular |
| `vscode-angular.createAngularPipe` | Generate Pipe | Angular |
| `vscode-angular.openFileInfo` | `__Open File Info__` | React (placeholder) |
| `vscode-angular.openInTerminal` | `__Open in Terminal__` | React (placeholder) |

Underscore titles mark unfinished React items.

## Webview IDs and message commands

| File | Panel viewType | Tab title | Hidden `command` |
|------|----------------|-----------|------------------|
| `generate-application.ts` | `formPageGenerateAngularApplication` | Angular Generate Application | `angular-create-application` |
| `generate-component.ts` | `formPageGenerateAngularComponent` | Angular Generate Component | `angular-create-component` |
| `generate-directive.ts` | `formPageGenerateAngularDirective` | Angular Generate Directive | `angular-create-directive` |
| `generate-pipe.ts` | `formPageGenerateAngularPipe` | Angular Generate Pipe | `angular-create-pipe` |

CSS URI: `vscode.Uri.joinPath(extensionUri, 'dist', 'media', 'styles.css')` then `asWebviewUri`. After webpack, that file is the copy of `src/styles/styles.css`.

## Nx command mapping

Name on the CLI is snake_case from Pascal/camel input.

### Application (`@nx/angular:application`)

```
nx g @nx/angular:application ${path}/${in_folder ? name + '/' : ''}
  [--skipTests]
  [--style=${style}]
  [--prefix=${prefix}]
```

Form fields actually rendered: path, type, name, prefix, style, skip_tests.

### Component (`@nx/angular:component`)

```
nx g @nx/angular:component ${path}/${in_folder ? name + '/' : ''}${name}${sufix ? '.component' : ''}
  [--standalone=false]   # only if standalone checkbox checked
  [--inlineStyle]
  [--inlineTemplate]
  [--skipTests]
  [--skipSelector]       # coded; field not in form
  [--skipImport]
  [--changeDetection=OnPush]
```

### Directive / pipe

Same path/name/suffix pattern with `.directive` / `.pipe`.

```
--standalone=false | --skipTests | --skipImport
```

## Form primitives

`TextElement(label, name, value)` — text input, `maxlength=64`.

`SelectElement(label, name, options, value)` — `<select>`. The `value` argument is unused for `selected`.

`BooleanElement(label, name, checked)` — hidden-styled checkbox + icon. `onchange` writes `localStorage`; load-from-storage is commented out.

`NameElement` ignores its `value` argument (input starts empty). `minlength=1` is not enforced in the extension handler.

## Tooling

| File | Notes |
|------|--------|
| `webpack.config.js` | Node target, `mode: 'none'` unless `package`, `devtool: 'nosources-source-map'` |
| `tsconfig.json` | `module: Node16`, `target/lib: ES2022`, `strict`, `rootDir: src` |
| `eslint.config.mjs` | TS files; naming-convention on imports; curly/eqeqeq/semi/no-throw-literal |
| `.vscode/tasks.json` | default build = `npm watch`; also `watch-tests`, `compile` |
| `.vscode/launch.json` | Extension Host, `outFiles: dist/**/*.js`, `preLaunchTask: ${defaultBuildTask}` |
| `.vscode/settings.json` | hide `out`/`dist` from search; `typescript.tsc.autoDetect: off` |
| `.vscodeignore` | ships `package.json` + `dist/`, not `src/` |

Engines: `vscode ^1.107.0`. No runtime `dependencies`; webpack/eslint/vscode-test are `devDependencies`.

## Package scripts

| Script | What |
|--------|------|
| `vscode:prepublish` | `npm run package` |
| `compile` | webpack |
| `watch` | webpack --watch |
| `package` | webpack production + hidden-source-map |
| `compile-tests` / `watch-tests` | `tsc` → `out/` |
| `pretest` | compile-tests + compile + lint |
| `lint` | `eslint src` |
| `test` | `vscode-test` |
