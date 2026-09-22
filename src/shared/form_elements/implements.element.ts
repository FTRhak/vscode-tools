import { BooleanElement } from "./base_elements/boolean.element";

export function ImplementsElement(): string {
    return (
        BooleanElement("CanActivate", "implements_can_activate", true) +
        BooleanElement("CanActivateChild", "implements_can_activate_child") +
        BooleanElement("CanDeactivate", "implements_can_deactivate") +
        BooleanElement("CanMatch", "implements_can_match")
    );
}
