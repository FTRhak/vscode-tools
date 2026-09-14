import * as path from "path";

import { componentCssTemplate } from "./templates/componentCssTemplate";
import { componentIndexTemplate } from "./templates/componentIndexTemplate";
import { componentPropsTemplate } from "./templates/componentPropsTemplate";
import { componentTestTemplate } from "./templates/componentTestTemplate";
import { componentTsxTemplate } from "./templates/componentTsxTemplate";

export interface ReactComponentOptions {
  workspaceRoot: string;
  relativePath: string;
  name: string;
  inFolder: boolean;
  externalProps: boolean;
  propsPath: string;
  exportDefault: boolean;
  skipTests: boolean;
  skipStyle: boolean;
  style: string;
}

export interface PlannedFile {
  fsPath: string;
  content: string;
}

export interface ReactComponentPlan {
  name: string;
  files: PlannedFile[];
  tsxPath: string;
  error?: string;
}

const PASCAL_IDENTIFIER = /^[A-Z][A-Za-z0-9]*$/;
const STYLE_EXTENSIONS = new Set(["css", "scss", "sass", "less"]);

export function resolveStyleExtension(style: string): string | undefined {
  const ext = (style || "css").toLowerCase();
  if (ext === "none" || ext === "") {
    return undefined;
  }
  if (STYLE_EXTENSIONS.has(ext)) {
    return ext;
  }
  return "css";
}

export function toPascalCase(raw: string): string {
  const words = raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
}

export function toRelativeImport(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile).split(path.sep).join("/");
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }
  return rel;
}

export function resolveWorkspacePath(
  workspaceRoot: string,
  targetPath: string,
): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.join(workspaceRoot, targetPath);
}

export function planReactComponentGeneration(
  options: ReactComponentOptions,
): ReactComponentPlan {
  const name = toPascalCase(options.name);
  if (!name || !PASCAL_IDENTIFIER.test(name)) {
    return {
      name,
      files: [],
      tsxPath: "",
      error: "Enter a valid component name.",
    };
  }

  const baseDir = resolveWorkspacePath(
    options.workspaceRoot,
    options.relativePath || ".",
  );
  const componentDir = options.inFolder ? path.join(baseDir, name) : baseDir;
  const tsxPath = path.join(componentDir, `${name}.tsx`);
  const propsTypeName = `${name}Props`;

  let propsImport: string | undefined;
  const files: PlannedFile[] = [];

  if (options.externalProps) {
    const propsPath = options.propsPath.trim();
    if (!propsPath) {
      return {
        name,
        files: [],
        tsxPath: "",
        error: "Enter a props path for the external props file.",
      };
    }

    const propsDir = resolveWorkspacePath(options.workspaceRoot, propsPath);
    const propsFile = path.join(propsDir, `${name}.props.ts`);
    const propsFileNoExt = path.join(propsDir, `${name}.props`);
    propsImport = toRelativeImport(tsxPath, propsFileNoExt);
    files.push({
      fsPath: propsFile,
      content: componentPropsTemplate(propsTypeName),
    });
  }

  const styleExt = options.skipStyle
    ? undefined
    : resolveStyleExtension(options.style);
  const styleImport = styleExt ? `./${name}.${styleExt}` : undefined;

  files.push({
    fsPath: tsxPath,
    content: componentTsxTemplate({
      name,
      propsTypeName,
      propsImport,
      styleImport,
      exportDefault: options.exportDefault,
    }),
  });

  if (styleExt) {
    files.push({
      fsPath: path.join(componentDir, `${name}.${styleExt}`),
      content: componentCssTemplate(name),
    });
  }

  if (!options.skipTests) {
    files.push({
      fsPath: path.join(componentDir, `${name}.test.tsx`),
      content: componentTestTemplate(name, options.exportDefault),
    });
  }

  if (options.inFolder) {
    files.push({
      fsPath: path.join(componentDir, "index.ts"),
      content: componentIndexTemplate(name, options.exportDefault),
    });
  }

  return { name, files, tsxPath };
}
