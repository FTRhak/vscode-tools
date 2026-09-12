import { BooleanElement } from "./base_elements/boolean.element";

export function StandaloneElement(checked: boolean = false): string {
    return BooleanElement('Standalone', 'standalone', checked);
};