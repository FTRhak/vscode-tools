import { SelectElement } from "./base_elements/select.element";

export function ViewEncapsulationElement(): string {
    return SelectElement("View Encapsulation", "view_encapsulation", [
        { label: "Default", value: "" },
        { label: "Emulated", value: "Emulated" },
        { label: "None", value: "None" },
        { label: "ShadowDom", value: "ShadowDom" },
    ]);
}
