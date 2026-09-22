import { SelectElement } from "./base_elements/select.element";

export function TypeSeparatorElement(): string {
    return SelectElement("Type Separator", "type_separator", [
        { label: "-", value: "-" },
        { label: ".", value: "." },
    ]);
}
