export type PropsKind = "type" | "interface";

export function resolvePropsKind(value: string): PropsKind {
  return value === "interface" ? "interface" : "type";
}

export function propsDeclaration(
  propsTypeName: string,
  kind: PropsKind,
  exported: boolean,
): string {
  const prefix = exported ? "export " : "";
  if (kind === "interface") {
    return `${prefix}interface ${propsTypeName} {}`;
  }
  return `${prefix}type ${propsTypeName} = {};`;
}

export function componentPropsTemplate(
  propsTypeName: string,
  kind: PropsKind,
): string {
  return `${propsDeclaration(propsTypeName, kind, true)}\n`;
}
