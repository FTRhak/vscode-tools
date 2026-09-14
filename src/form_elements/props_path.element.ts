export function PropsPathElement(value: string = ""): string {
    return `<div class="form-group">
        <label for="cprops_path">Props path:</label>
        <input type="text" id="cprops_path" name="props_path" class="form-input" value="${value}">
    </div>`;
}
