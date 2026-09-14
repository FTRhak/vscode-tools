import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import {
  FileTypeElement,
  InFolderElement,
  NameElement,
  PathElement,
  ProjectElement,
  SkipTestsElement,
  SufixElement,
  TypeElement,
} from "../form_elements";

export function angularCommandGenerateClass(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to create a new Angular class (placeholder implementation)
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularClass",
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
          "formPageGenerateAngularClass", // internal ID
          "Angular Generate Class", // tab title
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
            if (message.command === "angular-create-class") {
              let path = message.path;
              let name = message.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase();
              let in_folder = !!message.in_folder;
              const sufix = !!message.sufix;

              vscode.window.showInformationMessage(
                `Generating Class: ${name}`,
              );

              let command = 'echo "Error Command"';
              const flags =
                (message.skip_tests ? " --skipTests" : "") +
                (message.project ? ` --project=${message.project}` : "") +
                (message.file_type ? ` --type=${message.file_type}` : "");
              const target = `${path}/${in_folder ? name + "/" : ""}${name}${sufix ? ".class" : ""}`;

              if (message.type === "ng") {
                command = `ng generate class ${target}` + flags;
              } else if (message.type === "nx") {
                command = `nx g @nx/angular:class ${target}` + flags;
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
  <title>Generate class</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <div class="container">
    <h2>Generate class for:</h2>
    <form id="myForm">
      <input type="hidden" name="command" value="angular-create-class">
      ${PathElement(pathUrl)}
      ${TypeElement()}
      ${NameElement("", "class")}
      ${ProjectElement()}
      ${FileTypeElement()}
      ${InFolderElement(false)}
      ${SufixElement(false, "class")}
      ${SkipTestsElement()}

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
