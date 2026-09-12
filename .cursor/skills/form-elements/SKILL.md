---
name: form-elements
description: Catalog of vscode-tools webview HTML form factories in src/form_elements. Use when composing Angular/Nx generator webviews, adding or choosing form fields, mapping FormData keys, or wrapping TextElement/SelectElement/BooleanElement. Do not read src/form_elements unless changing a factory's HTML.
---

# Form elements

HTML string factories for generator webviews. Import from `../form_elements` (barrel `index.ts`). Each factory returns a string. Do not inline raw inputs unless adding a new primitive.

Do **not** open `src/form_elements/*.ts` for composition. This file is the catalog.

## Rules

- Unchecked checkboxes are **absent** from `FormData`. Read with `!!message.<field>`.
- Input `id` is `c` + `name` (Name uses `cName`, Path uses `cPath`).
- CSS: wrap in `form-group`. Classes: `form-input`, `form-select`, `form-checkbox`, `form-checkbox-icon`, `form-checkbox-label`.
- Boolean checkboxes write `localStorage` on change (`localStorage.setItem(name, this.checked)`). Restore from storage is commented out.
- `SelectElement` does **not** mark the option matching `value`. First option is always shown.
- `NameElement` ignores `value`; the input has no `value` attribute.
- Spelling `sufix` is intentional. Do not rename to `suffix`.
- Standalone inversion lives in the generator CLI, not the factory: checked `standalone` → `--standalone=false`.

## Base primitives (`src/form_elements/base_elements/`)

Use these only when wrapping a **new** field. Prefer an existing factory from the catalog.

| Factory | Signature | HTML |
|---------|-----------|------|
| `TextElement` | `(label, name, value = '')` | labeled text, `maxlength="64"` |
| `SelectElement` | `(label, name, options: {label, value}[], value = '')` | labeled `<select>`; `value` unused for selected |
| `BooleanElement` | `(label, name, value = false)` | checkbox + icon + label |

## Catalog (re-exported from `index.ts`)

| Factory | Signature | FormData `name` | Default | Control | Label / options |
|---------|-----------|-----------------|---------|---------|-----------------|
| `PathElement` | `(value = '')` | `path` | `''` | text, **readonly** | Path |
| `TypeElement` | `(value = '')` | `type` | first option `ng` (arg unused) | select | `ng` \| `nx` |
| `NameElement` | `(value = '', label)` | `name` | empty; `value` unused | text `minlength=1` `maxlength=64` | `Name of ${label}` |
| `PrefixElement` | `(value = 'app')` | `prefix` | `'app'` | text | Prefix |
| `StylesElement` | `()` | `style` | first option `css` | select | `css` \| `scss` \| `less` |
| `InFolderElement` | `(checked = true)` | `in_folder` | `true` | checkbox | Create in folder |
| `SufixElement` | `(checked = false, label)` | `sufix` | `false` | checkbox | `Include Sufix '${label}'` |
| `StandaloneElement` | `(checked = false)` | `standalone` | `false` | checkbox | Standalone |
| `InlineStyleElement` | `(checked = false)` | `inline_style` | `false` | checkbox | Inline Style |
| `InlineTemplateElement` | `(checked = false)` | `inline_template` | `false` | checkbox | Inline Template |
| `SkipTestsElement` | `(checked = false)` | `skip_tests` | `false` | checkbox | Skip Tests |
| `SkipImportModuleElement` | `(checked = false)` | `skip_import_module` | `false` | checkbox | Skip Import Module |
| `SkipSelectorElement` | `(checked = false)` | `skip_selector` | `false` | checkbox | Skip Selector |
| `ChangeDetectionElement` | `()` | `change_detection` | `""` (Default) | select | `""` Default \| `OnPush` |
| `RoutingElement` | `(checked = false)` | `routing` | `false` | checkbox | Routing |

Custom HTML (not a base wrap): `PathElement`, `NameElement`.

## Typical interpolations in generators

Call with the args generators already use. `NameElement` second arg is the kind word in the label; `SufixElement` second arg is the suffix shown in the checkbox.

```
${PathElement(pathUrl)}
${TypeElement()}
${NameElement("", "<kind>")}
${PrefixElement()}
${StylesElement()}
${InFolderElement(true)}
${SufixElement(true, "<kind>")}
${StandaloneElement()}
${InlineStyleElement()}
${InlineTemplateElement()}
${SkipTestsElement()}
${SkipImportModuleElement()}
${SkipSelectorElement()}
${ChangeDetectionElement()}
${RoutingElement()}
```

## Which generators render which fields

| Field | application | component | directive | pipe | module |
|-------|-------------|-----------|-----------|------|--------|
| `path` | yes | yes | yes | yes | yes |
| `type` | yes | yes | yes | yes | yes |
| `name` | yes | yes | yes | yes | yes |
| `prefix` | yes | | | | |
| `style` | yes | | | | |
| `in_folder` | | yes (`true`) | yes (`true`) | yes (`true`) | yes (`true`) |
| `sufix` | | yes (`true`, component) | yes (`true`, directive) | yes (`true`, pipe) | yes (`true`, module) |
| `standalone` | | yes | yes | yes | |
| `inline_style` | | yes | | | |
| `inline_template` | | yes | | | |
| `skip_tests` | yes | yes | yes | yes | |
| `skip_import_module` | | yes | yes | yes | |
| `skip_selector` | | CLI reads it; **form does not render** | | | |
| `change_detection` | | yes | | | |
| `routing` | | | | | yes |

Application handler still reads `message.in_folder` / `message.sufix` even though those fields are not on the form.

## CLI mapping (when the field is present)

| FormData | Flag / use |
|----------|------------|
| `path`, `name`, `in_folder`, `sufix` | path shape `${path}/${in_folder ? name+'/' : ''}${name}${sufix ? '.<kind>' : ''}` (application omits `name`+suffix in the path) |
| `type` | `nx` implemented; `ng` branch exists per generator — do not assume `ng` works end-to-end |
| `prefix` | `--prefix=${prefix}` |
| `style` | `--style=${style}` |
| `standalone` checked | `--standalone=false` |
| `inline_style` | `--inlineStyle` |
| `inline_template` | `--inlineTemplate` |
| `skip_tests` | `--skipTests` |
| `skip_import_module` | `--skipImport` |
| `skip_selector` | `--skipSelector` |
| `change_detection` nonempty | `--changeDetection=${value}` |
| `routing` | `--routing` |

Name sent to CLI: `message.name.split(/(?=[A-Z])/).join('_').toLowerCase()`.

## Add a field

1. If a catalog factory already covers it, compose that factory in the webview HTML.
2. Else wrap `BooleanElement` / `TextElement` / `SelectElement` in `src/form_elements/<field>.element.ts`.
3. Export from `src/form_elements/index.ts`.
4. Interpolate in the generator form. Match `message.<name>` in `onDidReceiveMessage`.
5. Update this skill's catalog and generator table.

Hidden `command` input is **not** a form element; each generator sets it in the HTML string (e.g. `angular-create-component`).
