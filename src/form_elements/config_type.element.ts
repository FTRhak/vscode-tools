import { SelectElement } from "./base_elements/select.element";

export function ConfigTypeElement(): string {
    const options = [
        { label: "Browserslist", value: "browserslist" },
        { label: "Karma", value: "karma" },
        { label: "Vitest", value: "vitest" },
    ];
    return SelectElement("Config Type", "config_type", options);
}
