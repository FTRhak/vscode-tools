import { BooleanElement } from "./base_elements/boolean.element";

export function DisplayBlockElement(checked: boolean = false): string {
    return BooleanElement("Display Block", "display_block", checked);
}
