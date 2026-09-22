import { BooleanElement } from "./base_elements/boolean.element";

export function SufixElement(checked: boolean = false, label: string): string {
    return BooleanElement(`Include Sufix '${label}'`, 'sufix', checked);
};