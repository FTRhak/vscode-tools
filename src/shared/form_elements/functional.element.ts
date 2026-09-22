import { BooleanElement } from "./base_elements/boolean.element";

export function FunctionalElement(checked: boolean = true): string {
    return BooleanElement("Functional", "functional", checked);
}
