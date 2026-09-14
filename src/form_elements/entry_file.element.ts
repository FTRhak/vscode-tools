import { TextElement } from "./base_elements/text.element";

export function EntryFileElement(value: string = "public-api"): string {
    return TextElement("Entry File", "entry_file", value);
}
