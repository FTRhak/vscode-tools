import { TextElement } from "./base_elements/text.element";

export function PrefixElement(value: string = 'app'): string {
    return TextElement('Prefix', 'prefix', value);
};