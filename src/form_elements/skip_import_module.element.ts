import { BooleanElement } from "./base_elements/boolean.element";

export function SkipImportModuleElement(checked: boolean = false): string {
    return BooleanElement('Skip Import Module', 'skip_import_module', checked);
}