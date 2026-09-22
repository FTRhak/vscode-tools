import { SelectElement } from "./base_elements/select.element";

export function TypeElement(value: string = ''): string {
    return SelectElement("Type", "type", [
        { label: "ng", value: "ng" },
        { label: "nx", value: "nx" },
    ], value);
}