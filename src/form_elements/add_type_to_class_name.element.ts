import { BooleanElement } from "./base_elements/boolean.element";

export function AddTypeToClassNameElement(checked: boolean = true): string {
    return BooleanElement("Add Type to Class Name", "add_type_to_class_name", checked);
}
