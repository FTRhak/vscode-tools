import { BooleanElement } from "./base_elements/boolean.element";

export function NgHtmlElement(checked: boolean = false): string {
    return BooleanElement("Ng HTML", "ng_html", checked);
}
