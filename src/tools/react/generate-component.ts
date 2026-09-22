import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import {
  ExportDefaultElement,
  ExternalPropsElement,
  InFolderElement,
  NameElement,
  PathElement,
  PropsPathElement,
  SkipStyleElement,
  SkipTestsElement,
  StylesElement,
  TypeDeclarationElement,
} from "../../shared/form_elements/index";
import { planReactComponentGeneration } from "./component-generation";

export function reactCommandGenerateComponent(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  const commands: vscode.Disposable[] = [];

  commands.push(
    vscode.commands.registerCommand(
      "vscode-react.createReactComponent",
      (resource: vscode.Uri) => {
        if (!resource) {
          vscode.window.showErrorMessage(
            "Select a folder in Explorer to generate a React component.",
          );
          return;
        }

        let absolutePath = resource.fsPath;
        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
          absolutePath = path.dirname(absolutePath);
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource);
        if (!workspaceFolder) {
          vscode.window.showErrorMessage(
            "Open a workspace folder to generate a React component.",
          );
          return;
        }

        const relativePath = path.relative(
          workspaceFolder.uri.fsPath,
          absolutePath,
        );
        const workspaceRoot = workspaceFolder.uri.fsPath;

        const panel = vscode.window.createWebviewPanel(
          "formPageGenerateReactComponent",
          "React Generate Component",
          vscode.ViewColumn.One,
          { enableScripts: true },
        );

        panel.webview.html = getWebviewContent(
          panel,
          context.extensionUri,
          relativePath,
        );

        panel.webview.onDidReceiveMessage(
          async (message) => {
            if (message.command !== "react-create-component") {
              return;
            }

            const plan = planReactComponentGeneration({
              workspaceRoot,
              relativePath: message.path || relativePath,
              name: message.name || "",
              inFolder: !!message.in_folder,
              externalProps: !!message.external_props,
              propsPath: message.props_path || "",
              exportDefault: !!message.export_default,
              skipTests: !!message.skip_tests,
              skipStyle: !!message.skip_style,
              style: message.style || "css",
              typeDeclaration: message.type_declaration || "type",
            });

            if (plan.error) {
              vscode.window.showErrorMessage(plan.error);
              return;
            }

            const existing = plan.files.filter((file) =>
              fs.existsSync(file.fsPath),
            );
            if (existing.length > 0) {
              const names = existing
                .map((file) => path.basename(file.fsPath))
                .join(", ");
              const choice = await vscode.window.showWarningMessage(
                `Overwrite existing files: ${names}?`,
                "Overwrite",
                "Cancel",
              );
              if (choice !== "Overwrite") {
                return;
              }
            }

            for (const file of plan.files) {
              fs.mkdirSync(path.dirname(file.fsPath), { recursive: true });
              fs.writeFileSync(file.fsPath, file.content, "utf8");
            }

            vscode.window.showInformationMessage(
              `Generated React component: ${plan.name}`,
            );
            const document = await vscode.workspace.openTextDocument(
              plan.tsxPath,
            );
            await vscode.window.showTextDocument(document);
          },
          undefined,
          context.subscriptions,
        );
      },
    ),
  );

  return commands;
}

function getWebviewContent(
  panel: vscode.WebviewPanel,
  extensionUri: vscode.Uri,
  pathUrl: string,
): string {
  const stylePath = vscode.Uri.joinPath(
    extensionUri,
    "dist",
    "media",
    "styles.css",
  );
  const styleUri = panel.webview.asWebviewUri(stylePath);
  const defaultPropsPath = pathUrl
    ? `${pathUrl.replace(/\\/g, "/")}/props`
    : "props";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Generate component</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <div class="container">
    <h2>Generate React component for:</h2>
    <form id="myForm">
      <input type="hidden" name="command" value="react-create-component">
      ${PathElement(pathUrl)}
      ${NameElement("", "component")}
      ${InFolderElement(false)}
      ${ExternalPropsElement()}
      <div id="propsPathGroup" style="display:none">
        ${PropsPathElement(defaultPropsPath)}
      </div>
      ${TypeDeclarationElement()}
      ${ExportDefaultElement()}
      ${SkipTestsElement()}
      ${SkipStyleElement()}
      <div id="styleGroup">
        ${StylesElement()}
      </div>
      <button type="submit" id="submitBtn" class="btn">Generate</button>
    </form>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const externalProps = document.getElementById('cexternal_props');
    const propsPathGroup = document.getElementById('propsPathGroup');
    const skipStyle = document.getElementById('cskip_style');
    const styleGroup = document.getElementById('styleGroup');
    function syncPropsPath() {
      propsPathGroup.style.display = externalProps.checked ? '' : 'none';
    }
    function syncStyle() {
      styleGroup.style.display = skipStyle.checked ? 'none' : '';
    }
    externalProps.addEventListener('change', syncPropsPath);
    skipStyle.addEventListener('change', syncStyle);
    syncPropsPath();
    syncStyle();
    document.getElementById('myForm').addEventListener('submit', (ev) => {
      const formData = new FormData(ev.target);
      const formObject = Object.fromEntries(formData.entries());
      vscode.postMessage(formObject);

      ev.stopPropagation();
      ev.preventDefault();
      return false;
    });
  </script>
</body>
</html>`;
}
