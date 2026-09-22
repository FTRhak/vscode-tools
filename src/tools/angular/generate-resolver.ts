import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import {
  FunctionalElement,
  InFolderElement,
  NameElement,
  PathElement,
  ProjectElement,
  SkipTestsElement,
  SufixElement,
  TypeElement,
  TypeSeparatorElement,
} from "../../shared/form_elements/index";

export function angularCommandGenerateResolver(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to create a new Angular resolver
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularResolver",
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
          "formPageGenerateAngularResolver", // internal ID
          "Angular Generate Resolver", // tab title
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
            if (message.command === "angular-create-resolver") {
              let path = message.path;
              let name = message.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase();
              let in_folder = !!message.in_folder;
              const sufix = !!message.sufix;

              vscode.window.showInformationMessage(
                `Generating Resolver: ${name}`,
              );

              let command = 'echo "Error Command"';
              const flags =
                (!message.functional ? " --functional=false" : "") +
                (message.skip_tests ? " --skipTests" : "") +
                (message.project ? ` --project=${message.project}` : "") +
                (message.type_separator
                  ? ` --typeSeparator=${message.type_separator}`
                  : "");
              const target = `${path}/${in_folder ? name + "/" : ""}${name}${sufix ? ".resolver" : ""}`;

              if (message.type === "ng") {
                command = `ng generate resolver ${target}` + flags;
              } else if (message.type === "nx") {
                command = `nx g @nx/angular:resolver ${target}` + flags;
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
  <title>Generate resolver</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <div class="container">
    <h2>Generate resolver for:</h2>
    <form id="myForm">
      <input type="hidden" name="command" value="angular-create-resolver">
      ${PathElement(pathUrl)}
      ${TypeElement()}
      ${NameElement("", "resolver")}
      ${ProjectElement()}
      ${TypeSeparatorElement()}
      ${InFolderElement(false)}
      ${SufixElement(true, "resolver")}
      ${FunctionalElement(true)}
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
