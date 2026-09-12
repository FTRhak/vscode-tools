import { BooleanElement } from "./base_elements/boolean.element";

export function InFolderElement(checked: boolean = true): string {
    return BooleanElement('Create in folder', 'in_folder', checked);
}