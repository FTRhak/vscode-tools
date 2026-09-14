import { BooleanElement } from "./base_elements/boolean.element";

export function SkipStyleElement(checked: boolean = false): string {
    return BooleanElement("Skip Style", "skip_style", checked);
}
