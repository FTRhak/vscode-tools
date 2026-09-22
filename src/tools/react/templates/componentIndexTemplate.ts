export function componentIndexTemplate(
  name: string,
  exportDefault: boolean,
): string {
  if (exportDefault) {
    return `export { default } from "./${name}";\n`;
  }
  return `export { ${name} } from "./${name}";\n`;
}
