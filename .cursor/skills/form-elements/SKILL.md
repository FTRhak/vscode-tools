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
- Add-type-to-class-name inversion lives in the generator CLI: factory default checked; absent `add_type_to_class_name` → `--addTypeToClassName=false`.
- Functional inversion lives in the generator CLI: factory default checked; absent `functional` → `--functional=false`.

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
| `ConfigTypeElement` | `()` | `config_type` | first option `browserslist` | select | `browserslist` \| `karma` \| `vitest` |
| `NameElement` | `(value = '', label)` | `name` | empty; `value` unused | text `minlength=1` `maxlength=64` | `Name of ${label}` |
| `PrefixElement` | `(value = 'app')` | `prefix` | `'app'` | text | Prefix |
| `EntryFileElement` | `(value = 'public-api')` | `entry_file` | `'public-api'` | text | Entry File |
| `ProjectElement` | `(value = '')` | `project` | `''` | text | Project |
| `SelectorElement` | `(value = '')` | `selector` | `''` | text | Selector |
| `FileTypeElement` | `(value = '')` | `file_type` | `''` | text | File Type (`--type`) |
| `FunctionalElement` | `(checked = true)` | `functional` | `true` | checkbox | Functional |
| `ImplementsElement` | `()` | `implements_can_activate`, `implements_can_activate_child`, `implements_can_deactivate`, `implements_can_match` | `CanActivate` checked | four checkboxes | `CanActivate` \| `CanActivateChild` \| `CanDeactivate` \| `CanMatch` |
| `AddTypeToClassNameElement` | `(checked = true)` | `add_type_to_class_name` | `true` | checkbox | Add Type to Class Name |
| `StylesElement` | `(includeDefault = false)` | `style` | first option `css` (or `""` Default if `includeDefault`) | select | optional Default \| `css` \| `scss` \| `sass` \| `less` \| `none` |
| `InFolderElement` | `(checked = true)` | `in_folder` | `true` | checkbox | Create in folder |
| `InjectableElement` | `(checked = false)` | `injectable` | `false` | checkbox | Injectable |
| `SufixElement` | `(checked = false, label)` | `sufix` | `false` | checkbox | `Include Sufix '${label}'` |
| `StandaloneElement` | `(checked = false)` | `standalone` | `false` | checkbox | Standalone |
| `InlineStyleElement` | `(checked = false)` | `inline_style` | `false` | checkbox | Inline Style |
| `InlineTemplateElement` | `(checked = false)` | `inline_template` | `false` | checkbox | Inline Template |
| `DisplayBlockElement` | `(checked = false)` | `display_block` | `false` | checkbox | Display Block |
| `NgHtmlElement` | `(checked = false)` | `ng_html` | `false` | checkbox | Ng HTML |
| `SkipTestsElement` | `(checked = false)` | `skip_tests` | `false` | checkbox | Skip Tests |
| `SkipInstallElement` | `(checked = false)` | `skip_install` | `false` | checkbox | Skip Install |
| `SkipPackageJsonElement` | `(checked = false)` | `skip_package_json` | `false` | checkbox | Skip Package JSON |
| `SkipTsConfigElement` | `(checked = false)` | `skip_ts_config` | `false` | checkbox | Skip TS Config |
| `SkipImportModuleElement` | `(checked = false)` | `skip_import_module` | `false` | checkbox | Skip Import Module |
| `SkipSelectorElement` | `(checked = false)` | `skip_selector` | `false` | checkbox | Skip Selector |
| `ModuleElement` | `(value = '')` | `module` | `''` | text | Module |
| `ExportElement` | `(checked = false)` | `export` | `false` | checkbox | Export |
| `ExportDefaultElement` | `(checked = false)` | `export_default` | `false` | checkbox | Export Default |
| `ChangeDetectionElement` | `()` | `change_detection` | `""` (Default) | select | `""` Default \| `Eager` \| `OnPush` |
| `ViewEncapsulationElement` | `()` | `view_encapsulation` | `""` (Default) | select | `""` Default \| `Emulated` \| `None` \| `ShadowDom` |
| `RoutingElement` | `(checked = false)` | `routing` | `false` | checkbox | Routing |
| `TestRunnerElement` | `()` | `test_runner` | first option `vitest` | select | `vitest` \| `karma` |
| `TargetElement` | `(value = 'build')` | `target` | `'build'` | text | Target |
| `TypeSeparatorElement` | `()` | `type_separator` | first option `-` | select | `-` \| `.` |

Custom HTML (not a base wrap): `PathElement`, `NameElement`.

## Typical interpolations in generators

Call with the args generators already use. `NameElement` second arg is the kind word in the label; `SufixElement` second arg is the suffix shown in the checkbox.

```
${PathElement(pathUrl)}
${TypeElement()}
${TargetElement()}
${ConfigTypeElement()}
${NameElement("", "<kind>")}
${PrefixElement()}
${EntryFileElement()}
${ProjectElement()}
${SelectorElement()}
${FileTypeElement()}
${FunctionalElement(true)}
${ImplementsElement()}
${AddTypeToClassNameElement(true)}
${StylesElement()}
${StylesElement(true)}
${InFolderElement(true)}
${InjectableElement()}
${SufixElement(true, "<kind>")}
${StandaloneElement()}
${InlineStyleElement()}
${InlineTemplateElement()}
${DisplayBlockElement()}
${NgHtmlElement()}
${SkipTestsElement()}
${SkipInstallElement()}
${SkipPackageJsonElement()}
${SkipTsConfigElement()}
${SkipImportModuleElement()}
${SkipSelectorElement()}
${ModuleElement()}
${ExportElement()}
${ExportDefaultElement()}
${ChangeDetectionElement()}
${ViewEncapsulationElement()}
${RoutingElement()}
${TestRunnerElement()}
${TypeSeparatorElement()}
```

## Which generators render which fields

| Field | application | class | component | config | directive | pipe | module | service | environment | interceptor | guard | library | resolver | service-worker |
|-------|-------------|-------|-----------|--------|-----------|------|--------|---------|-------------|-------------|-------|---------|----------|----------------|
| `path` | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| `type` | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| `config_type` | | | | yes | | | | | | | | | | |
| `name` | yes | yes | yes | | yes | yes | yes | yes | | yes | yes | yes | yes | |
| `prefix` | yes | | yes (`""`) | | yes (`""`) | | | | | | | yes (`"lib"`) | | |
| `entry_file` | | | | | | | | | | | | yes (`"public-api"`) | | |
| `project` | | yes | yes | yes | yes | | | yes | yes | yes | yes | | yes | yes |
| `target` | | | | | | | | | | | | | | yes (`"build"`) |
| `selector` | | | yes | | yes | | | | | | | | | |
| `functional` | | | | | | | | | | yes (`true`) | yes (`true`) | | yes (`true`) | |
| `implements_*` | | | | | | | | | | | yes (`CanActivate`) | | | |
| `file_type` | | yes | yes | | yes | | | yes | | | | | | |
| `add_type_to_class_name` | | | yes (`true`) | | yes (`true`) | | | yes (`true`) | | | | | | |
| `style` | yes | | yes (`includeDefault`) | | | | | | | | | | | |
| `in_folder` | | yes (`false`) | yes (`true`) | | yes (`true`) | yes (`true`) | yes (`true`) | yes (`false`) | | yes (`false`) | yes (`false`) | | yes (`false`) | |
| `injectable` | | | | | | | | yes | | | | | | |
| `sufix` | | yes (`false`, class) | yes (`true`, component) | | yes (`true`, directive) | yes (`true`, pipe) | yes (`true`, module) | yes (`true`, service) | | yes (`true`, interceptor) | yes (`true`, guard) | | yes (`true`, resolver) | |
| `standalone` | | | yes | | yes | yes | | | | | | yes | | |
| `inline_style` | | | yes | | | | | | | | | | | |
| `inline_template` | | | yes | | | | | | | | | | | |
| `display_block` | | | yes | | | | | | | | | | | |
| `ng_html` | | | yes | | | | | | | | | | | |
| `skip_tests` | yes | yes | yes | | yes | yes | | yes | | yes | yes | | yes | |
| `skip_install` | | | | | | | | | | | | yes | | |
| `skip_package_json` | | | | | | | | | | | | yes | | |
| `skip_ts_config` | | | | | | | | | | | | yes | | |
| `skip_import_module` | | | yes | | yes | yes | | | | | | | | |
| `skip_selector` | | | yes | | | | | | | | | | | |
| `module` | | | yes | | yes | | | | | | | | | |
| `export` | | | yes | | yes | | | | | | | | | |
| `export_default` | | | yes | | | | | | | | | | | |
| `change_detection` | | | yes | | | | | | | | | | | |
| `view_encapsulation` | | | yes | | | | | | | | | | | |
| `routing` | | | | | | | yes | | | | | | | |
| `test_runner` | | | | | | | | | | | | yes | | |
| `type_separator` | | | | | | | | | | yes | yes | | yes | |

Application handler still reads `message.in_folder` / `message.sufix` even though those fields are not on the form.

## CLI mapping (when the field is present)

| FormData | Flag / use |
|----------|------------|
| `path`, `name`, `in_folder`, `sufix` | path shape `${path}/${in_folder ? name+'/' : ''}${name}${sufix ? '.<kind>' : ''}` (application omits `name`+suffix in the path) |
| `type` | `nx` implemented; `ng` branch exists per generator — do not assume `ng` works end-to-end |
| `config_type` | positional argument after `config` (`browserslist` \| `karma` \| `vitest`) |
| `prefix` nonempty | `--prefix=${prefix}` |
| `entry_file` nonempty | `--entryFile=${entry_file}` |
| `path` nonempty (library) | `--projectRoot=${path}` |
| `project` nonempty | `--project=${project}` |
| `selector` nonempty | `--selector=${selector}` |
| `file_type` nonempty | `--type=${file_type}` |
| `functional` absent | `--functional=false` |
| `implements_can_activate` / `_child` / `_deactivate` / `_match` | `--implements=` comma-joined `CanActivate`, `CanActivateChild`, `CanDeactivate`, `CanMatch` |
| `add_type_to_class_name` absent | `--addTypeToClassName=false` |
| `style` nonempty | `--style=${style}` |
| `standalone` checked | `--standalone=false` |
| `inline_style` | `--inlineStyle` |
| `inline_template` | `--inlineTemplate` |
| `display_block` | `--displayBlock` |
| `ng_html` | `--ngHtml` |
| `injectable` | `--injectable` |
| `skip_tests` | `--skipTests` |
| `skip_install` | `--skipInstall` |
| `skip_package_json` | `--skipPackageJson` |
| `skip_ts_config` | `--skipTsConfig` |
| `skip_import_module` | `--skipImport` |
| `skip_selector` | `--skipSelector` |
| `module` nonempty | `--module=${module}` |
| `export` | `--export` |
| `export_default` | `--exportDefault` |
| `change_detection` nonempty | `--changeDetection=${value}` |
| `view_encapsulation` nonempty | `--viewEncapsulation=${value}` |
| `routing` | `--routing` |
| `test_runner` nonempty | `--testRunner=${test_runner}` |
| `target` nonempty | `--target=${target}` |
| `type_separator` nonempty | `--typeSeparator=${type_separator}` |

Name sent to CLI: `message.name.split(/(?=[A-Z])/).join('_').toLowerCase()`.

## Add a field

1. If a catalog factory already covers it, compose that factory in the webview HTML.
2. Else wrap `BooleanElement` / `TextElement` / `SelectElement` in `src/form_elements/<field>.element.ts`.
3. Export from `src/form_elements/index.ts`.
4. Interpolate in the generator form. Match `message.<name>` in `onDidReceiveMessage`.
5. Update this skill's catalog and generator table.

Hidden `command` input is **not** a form element; each generator sets it in the HTML string (e.g. `angular-create-component`).
