import { BooleanElement } from "./base_elements/boolean.element";

export function InjectableElement(checked: boolean = false): string {
    return BooleanElement("Injectable", "injectable", checked);
}
