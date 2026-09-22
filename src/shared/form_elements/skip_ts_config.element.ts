import { BooleanElement } from "./base_elements/boolean.element";

export function SkipTsConfigElement(checked: boolean = false): string {
    return BooleanElement("Skip TS Config", "skip_ts_config", checked);
}
