# vscode-tools

VS Code extension that adds **Schematics Tools** to the Explorer context menu. Generate Angular artifacts through Nx, or scaffold React components from templates, without typing generator commands by hand.

Publisher: [FTRhak](https://github.com/FTRhak) · [Issues](https://github.com/FTRhak/vscode-tools/issues)

## Features

- Explorer context submenu: **Schematics Tools → Angular | React**
- Form-based generators (path is prefilled from the folder you right-clicked)
- **Angular:** runs `nx g @nx/angular:<schematic> …` in a dedicated terminal
- **React:** writes component files from templates and opens the `.tsx` file

## Requirements

- Visual Studio Code `^1.107.0`
- A workspace folder open in the editor
- **Angular generators:** an [Nx](https://nx.dev) workspace with `@nx/angular` available (`nx` on your PATH)

Angular CLI (`ng`) is listed in the form but is not implemented. Use **nx**.

## Install

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=FTRhak.vscode-tools), or from a VSIX:

```bash
code --install-extension vscode-tools-0.0.1.vsix
```

## Usage

1. Open an Angular/Nx or React project.
2. In **Explorer**, right-click a folder (or a file — the parent folder is used).
3. Choose **Schematics Tools → Angular** or **Schematics Tools → React**.
4. Pick a generator, fill in the form, and submit.

The **Path** field is workspace-relative and read-only. It always matches the Explorer location you selected.

---

## Angular

Each Angular item opens a webview with options that map to `@nx/angular` flags. After you submit, a **Generation Terminal** runs the command so you can see Nx output.

| Menu item | Schematic |
|-----------|-----------|
| Generate Application | `application` |
| Generate Class | `class` |
| Generate Component | `component` |
| Generate Config | `config` |
| Generate Directive | `directive` |
| Generate Environments | `environments` |
| Generate Guard | `guard` |
| Generate Interceptor | `interceptor` |
| Generate Library | `library` |
| Generate Module | `module` |
| Generate Pipe | `pipe` |
| Generate Resolver | `resolver` |
| Generate Service | `service` |
| Generate Service Worker | `service-worker` |
| Generate Web Worker | `web-worker` |

Typical options (not every generator has all of these):

- **Name** — converted to snake_case for the CLI (`MyWidget` → `my_widget`)
- **Create in folder** — generate under `{path}/{name}/`
- **Include suffix** — append `.component`, `.pipe`, `.service`, and similar
- **Project**, **prefix**, **selector**, **style** (`css` / `scss` / `sass` / `less` / `none`)
- **Standalone** — when checked, the generator passes `--standalone=false` (NgModule-style output)
- Skip tests, skip import, inline style/template, change detection, view encapsulation, routing, and other Nx flags as shown on each form

The command runs in your workspace, so Nx still applies `nx.json` / project defaults.

---

## React

**Generate Component** writes files in the selected folder. It does not run `nx` or `ng`.

### Options

| Option | Effect |
|--------|--------|
| Name | PascalCase component name |
| Create in folder | `{path}/{Name}/` plus an `index.ts` barrel |
| External props declaration | `{Name}.props.ts` at the props path you enter |
| Type / interface | `type NameProps = {}` or `interface NameProps {}` |
| Export default | `export default function` and a matching barrel re-export |
| Skip tests | do not write `{Name}.test.tsx` |
| Skip style | do not write or import a style file |
| Style | `css`, `scss`, `sass`, `less`, or `none` |

### Files

```
Name.tsx                 # always
Name.css (or scss/…)     # unless skip style / style none
Name.test.tsx            # unless skip tests (React Testing Library)
index.ts                 # when Create in folder is checked
Name.props.ts            # when External props is checked
```

If a target file already exists, you are asked to overwrite or cancel. The generated `.tsx` file opens when generation succeeds.

---

## License

[MIT](LICENSE.txt)

## Contributing

Bug reports and feature requests: [github.com/FTRhak/vscode-tools/issues](https://github.com/FTRhak/vscode-tools/issues).
