import {BooleanElement} from './base_elements/boolean.element';

export function SkipSelectorElement(checked: boolean = false): string {
    return BooleanElement('Skip Selector', 'skip_selector', checked);
};