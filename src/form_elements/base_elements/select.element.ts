export function SelectElement(label: string, name: string, options: {label:string, value:string}[], value: string = ''): string {
    let optionsHtml = '';
    options.forEach(option => {
        optionsHtml += `<option value="${option.value}">${option.label}</option>`;
    });

    return `<div class="form-group">
        <label for="c${name}">${label}:</label>
        <select id="c${name}" name="${name}" class="form-select">
            ${optionsHtml}
        </select>
    </div>`;
}