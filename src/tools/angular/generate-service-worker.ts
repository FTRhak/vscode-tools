import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import {
  PathElement,
  ProjectElement,
  TargetElement,
  TypeElement,
} from "../../shared/form_elements/index";

export function angularCommandGenerateServiceWorker(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to add an Angular service worker
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularServiceWorker",
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
          "formPageGenerateAngularServiceWorker", // internal ID
          "Angular Generate Service Worker", // tab title
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
            if (message.command === "angular-create-service-worker") {
              vscode.window.showInformationMessage(
                `Generating Service Worker${message.project ? `: ${message.project}` : ""}`,
              );

              let command = 'echo "Error Command"';
              const flags =
                (message.project ? ` --project=${message.project}` : "") +
                (message.target ? ` --target=${message.target}` : "");

              if (message.type === "ng") {
                command = `ng generate service-worker` + flags;
              } else if (message.type === "nx") {
                command = `nx g @nx/angular:service-worker` + flags;
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
  <title>Generate service worker</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <div class="container">
    <h2>Generate service worker for:</h2>
    <form id="myForm">
      <input type="hidden" name="command" value="angular-create-service-worker">
      ${PathElement(pathUrl)}
      ${TypeElement()}
      ${ProjectElement()}
      ${TargetElement()}

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
