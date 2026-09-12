import { BooleanElement } from "./base_elements/boolean.element";

export function ExportDefaultElement(checked: boolean = false): string {
    return BooleanElement("Export Default", "export_default", checked);
}
