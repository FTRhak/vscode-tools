export function TextElement(label: string, name: string, value: string = ''): string {
    return `<div class="form-group">
        <label for="c${name}">${label}:</label>
        <input type="text" id="c${name}" name="${name}" value="${value}" class="form-input" maxlength="64" />
    </div>`;
}