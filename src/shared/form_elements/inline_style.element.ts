import { BooleanElement } from "./base_elements/boolean.element";

export function InlineStyleElement(checked: boolean = false): string {
    return BooleanElement('Inline Style', 'inline_style', checked);
}