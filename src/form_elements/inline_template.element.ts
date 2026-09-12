import { BooleanElement } from "./base_elements/boolean.element";

export function InlineTemplateElement(checked: boolean = false): string {
    return BooleanElement('Inline Template', 'inline_template', checked);
};