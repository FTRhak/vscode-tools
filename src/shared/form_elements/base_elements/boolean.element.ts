export function BooleanElement(label: string, name: string, value: boolean = false): string {
    /*const state = localStorage.getItem(name);
    if (state !== null) {
        value = state === 'true';
    }*/
    return `<div class="form-group">
        <input type="checkbox" id="c${name}" name="${name}" ${value ? 'checked="checked"' : ''} class="form-checkbox" onchange="localStorage.setItem('${name}', this.checked)" />
        <label for="c${name}" class="form-checkbox-icon"></label>
        <label for="c${name}" class="form-checkbox-label">${label}</label>
    </div>`;
}