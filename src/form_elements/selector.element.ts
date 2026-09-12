import { TextElement } from "./base_elements/text.element";

export function SelectorElement(value: string = ""): string {
    return TextElement("Selector", "selector", value);
}
