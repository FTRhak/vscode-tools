import { BooleanElement } from "./base_elements/boolean.element";

export function SkipTestsElement(checked: boolean = false): string {
    return BooleanElement('Skip Tests', 'skip_tests', checked);
}