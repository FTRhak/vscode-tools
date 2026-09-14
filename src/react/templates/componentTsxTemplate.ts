import {
  PropsKind,
  propsDeclaration,
} from "./componentPropsTemplate";

export function componentTsxTemplate(options: {
  name: string;
  propsTypeName: string;
  propsImport?: string;
  styleImport?: string;
  exportDefault: boolean;
  propsKind: PropsKind;
}): string {
  const {
    name,
    propsTypeName,
    propsImport,
    styleImport,
    exportDefault,
    propsKind,
  } = options;
  const exportKeyword = exportDefault
    ? "export default function"
    : "export function";
  const imports: string[] = [];
  if (styleImport) {
    imports.push(`import "${styleImport}";`);
  }
  if (propsImport) {
    imports.push(`import type { ${propsTypeName} } from "${propsImport}";`);
  }
  const importBlock = imports.length ? `${imports.join("\n")}\n\n` : "";
  const inlineProps = propsImport
    ? ""
    : `${propsDeclaration(propsTypeName, propsKind, false)}\n\n`;

  return `${importBlock}${inlineProps}${exportKeyword} ${name}(props: ${propsTypeName}) {
  return <div className="${name}"></div>;
}
`;
}
