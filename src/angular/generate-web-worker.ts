import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import {
  InFolderElement,
  NameElement,
  PathElement,
  ProjectElement,
  SnippetElement,
  SufixElement,
  TypeElement,
} from "../form_elements";

export function angularCommandGenerateWebWorker(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to create a new Angular web worker
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularWebWorker",
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
          "formPageGenerateAngularWebWorker", // internal ID
          "Angular Generate Web Worker", // tab title
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
            if (message.command === "angular-create-web-worker") {
              let path = message.path;
              let name = message.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase();
              let in_folder = !!message.in_folder;
              const sufix = !!message.sufix;

              vscode.window.showInformationMessage(
                `Generating Web Worker: ${name}`,
              );

              let command = 'echo "Error Command"';
              const flags =
                (!message.snippet ? " --snippet=false" : "") +
                (message.project ? ` --project=${message.project}` : "");
              const target = `${path}/${in_folder ? name + "/" : ""}${name}${sufix ? ".worker" : ""}`;

              if (message.type === "ng") {
                command = `ng generate web-worker ${target}` + flags;
              } else if (message.type === "nx") {
                command = `nx g @nx/angular:web-worker ${target}` + flags;
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
  <title>Generate web worker</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <h2>Generate web worker for:</h2>
  <form id="myForm">
    <input type="hidden" name="command" value="angular-create-web-worker">
    ${PathElement(pathUrl)}
    ${TypeElement()}
    ${NameElement("", "web worker")}
    ${ProjectElement()}
    ${InFolderElement(false)}
    ${SufixElement(true, "worker")}
    ${SnippetElement(true)}

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
