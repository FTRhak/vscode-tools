export function NameElement(value: string = '', label: string): string {
    return `<div class="form-group">
        <label for="cName">Name of ${label}:</label>
        <input type="text" id="cName" name="name"  class="form-input" minlength="1" maxlength="64" />
    </div>`;
};