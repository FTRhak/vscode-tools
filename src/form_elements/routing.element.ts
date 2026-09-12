import { BooleanElement } from "./base_elements/boolean.element";

export function RoutingElement(checked: boolean = false): string {
    return BooleanElement('Routing', 'routing', checked);
}
