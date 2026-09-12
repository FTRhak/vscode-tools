import { TextElement } from "./base_elements/text.element";

export function FileTypeElement(value: string = ""): string {
    return TextElement("File Type", "file_type", value);
}
