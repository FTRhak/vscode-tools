import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { PathElement, ProjectElement, TypeElement } from "../../shared/form_elements/index";

export function angularCommandGenerateEnvironment(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to create Angular environment files
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularEnvironment",
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
          "formPageGenerateAngularEnvironment", // internal ID
          "Angular Generate Environments", // tab title
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
            if (message.command === "angular-create-environment") {
              vscode.window.showInformationMessage(
                `Generating Environments${message.project ? `: ${message.project}` : ""}`,
              );

              let command = 'echo "Error Command"';
              const flags = message.project
                ? ` --project=${message.project}`
                : "";

              if (message.type === "ng") {
                command = `ng generate environments` + flags;
              } else if (message.type === "nx") {
                command = `nx g @nx/angular:environments` + flags;
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
  <title>Generate environments</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <div class="container">
    <h2>Generate environments for:</h2>
    <form id="myForm">
      <input type="hidden" name="command" value="angular-create-environment">
      ${PathElement(pathUrl)}
      ${TypeElement()}
      ${ProjectElement()}

      <button type="submit" id="submitBtn" class="btn">Generate</button>
    </form>
  </div>
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
