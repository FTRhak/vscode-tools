import { TextElement } from "./base_elements/text.element";

export function ModuleElement(value: string = ""): string {
    return TextElement("Module", "module", value);
}
