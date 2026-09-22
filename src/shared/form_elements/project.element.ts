import { TextElement } from "./base_elements/text.element";

export function ProjectElement(value: string = ""): string {
    return TextElement("Project", "project", value);
}
