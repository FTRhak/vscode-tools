import { SelectElement } from "./base_elements/select.element";

export function TestRunnerElement(): string {
    const options = [
        { label: "Vitest", value: "vitest" },
        { label: "Karma", value: "karma" },
    ];
    return SelectElement("Test Runner", "test_runner", options);
}
