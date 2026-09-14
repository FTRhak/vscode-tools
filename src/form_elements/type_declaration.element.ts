import { SelectElement } from "./base_elements/select.element";

export function TypeDeclarationElement(): string {
    const options = [
        { label: "Type", value: "type" },
        { label: "Interface", value: "interface" },
    ];
    return SelectElement("Type Declaration", "type_declaration", options);
}
