import { BooleanElement } from "./base_elements/boolean.element";

export function SkipInstallElement(checked: boolean = false): string {
    return BooleanElement("Skip Install", "skip_install", checked);
}
