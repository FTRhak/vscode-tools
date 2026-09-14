import { BooleanElement } from "./base_elements/boolean.element";

export function SkipPackageJsonElement(checked: boolean = false): string {
    return BooleanElement("Skip Package JSON", "skip_package_json", checked);
}
