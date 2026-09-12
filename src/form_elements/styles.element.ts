import { SelectElement } from "./base_elements/select.element";

export function StylesElement(): string {
    return SelectElement("Style", "style", [
        { label: "CSS", value: "css" },
        { label: "SCSS", value: "scss" },
        { label: "LESS", value: "less" },
    ]);
}