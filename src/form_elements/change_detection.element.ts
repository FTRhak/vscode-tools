import { SelectElement } from "./base_elements/select.element";

export function ChangeDetectionElement(): string {
    return SelectElement("Change Detection", "change_detection", [
        { label: "Default", value: "" },
        { label: "OnPush", value: "OnPush" },
    ]);
}