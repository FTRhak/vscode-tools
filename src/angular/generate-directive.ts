import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { PathElement } from "../form_elements/path.element";
import {
  InFolderElement,
  NameElement,
  SkipImportModuleElement,
  SkipTestsElement,
  StandaloneElement,
  SufixElement,
  TypeElement,
} from "../form_elements";

export function angularCommandGenerateDirective(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to create a new Angular component (placeholder implementation)
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularDirective",
      (resource: vscode.Uri) => {
        let absolutePath = resource.fsPath;
        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
          absolutePath = path.dirname(absolutePath);
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource);
        let relativePath = absolutePath;

        if (workspaceFolder) {
          relativePath = path.relative(
            workspaceFolder.uri.fsPath,
            absolutePath,
          );
        }

        const panel = vscode.window.createWebviewPanel(
          "formPageGenerateAngularDirective", // internal ID
          "Angular Generate Directive", // tab title
          vscode.ViewColumn.One, // show in first column
          { enableScripts: true }, // allow JS in the webview
        );

        // HTML content for the form
        panel.webview.html = getWebviewContent(
          panel,
          context.extensionUri,
          relativePath,
        );

        panel.webview.onDidReceiveMessage(
          (message) => {
            if (message.command === "angular-create-directive") {
              let path = message.path;
              let name = message.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase();
              let in_folder = !!message.in_folder;
              const sufix = !!message.sufix;

              vscode.window.showInformationMessage(
                `Generating Directive: ${name}`,
              );

              let command = 'echo "Error Command"';

              if (message.type === "ng") {
              } else if (message.type === "nx") {
                command =
                  `nx g @nx/angular:directive ${path}/${in_folder ? name + "/" : ""}${name}${sufix ? ".directive" : ""}` +
                  (message.standalone ? " --standalone=false" : "") +
                  (message.skip_tests ? " --skipTests" : "") +
                  (message.skip_import_module ? " --skipImport" : "");
              }

              const terminal = vscode.window.createTerminal(
                "Generation Terminal",
              );
              terminal.sendText(command);
              terminal.show();
            }
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
  panel: any,
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Generate directive</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <h2>Generate directive for:</h2>
  <form id="myForm">
    <input type="hidden" name="command" value="angular-create-directive">
    
    ${PathElement(pathUrl)}
        ${TypeElement()}
        ${NameElement("", "directive")}
        ${InFolderElement(true)}
        ${SufixElement(true, "directive")}
        ${StandaloneElement()}
        ${SkipTestsElement()}
        ${SkipImportModuleElement()}
    
    <button type="submit" id="submitBtn" class="btn">Generate</button>
  </form>

  <script>
    const vscode = acquireVsCodeApi();
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
