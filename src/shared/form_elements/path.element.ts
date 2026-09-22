export function PathElement(value: string = ''): string {
    return `<div class="form-group">
                <label for="cPath">Path:</label>
                <input type="text" id="cPath" name="path" class="form-input" readonly value="${value}">
            </div>`;
}
