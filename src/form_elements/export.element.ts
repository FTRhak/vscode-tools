import { BooleanElement } from "./base_elements/boolean.element";

export function ExportElement(checked: boolean = false): string {
    return BooleanElement("Export", "export", checked);
}
