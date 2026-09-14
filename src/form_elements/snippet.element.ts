import { BooleanElement } from "./base_elements/boolean.element";

export function SnippetElement(checked: boolean = true): string {
    return BooleanElement("Snippet", "snippet", checked);
}
