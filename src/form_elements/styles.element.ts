import { SelectElement } from "./base_elements/select.element";

export function StylesElement(includeDefault: boolean = false): string {
    const options = [
        { label: "CSS", value: "css" },
        { label: "SCSS", value: "scss" },
        { label: "SASS", value: "sass" },
        { label: "LESS", value: "less" },
        { label: "None", value: "none" },
    ];
    if (includeDefault) {
        options.unshift({ label: "Default", value: "" });
    }
    return SelectElement("Style", "style", options);
}