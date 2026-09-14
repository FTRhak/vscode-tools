import { TextElement } from "./base_elements/text.element";

export function TargetElement(value: string = "build"): string {
    return TextElement("Target", "target", value);
}
