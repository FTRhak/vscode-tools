import { BooleanElement } from "./base_elements/boolean.element";

export function ExternalPropsElement(checked: boolean = false): string {
    return BooleanElement("External props declaration", "external_props", checked);
}
