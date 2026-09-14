import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import {
  EntryFileElement,
  NameElement,
  PathElement,
  PrefixElement,
  SkipInstallElement,
  SkipPackageJsonElement,
  SkipTsConfigElement,
  StandaloneElement,
  TestRunnerElement,
  TypeElement,
} from "../form_elements";

export function angularCommandGenerateLibrary(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to create a new Angular library
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularLibrary",
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
          "formPageGenerateAngularLibrary", // internal ID
          "Angular Generate Library", // tab title
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
            if (message.command === "angular-create-library") {
              let path = message.path;
              let name = message.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase();

              vscode.window.showInformationMessage(
                `Generating Library: ${name}`,
              );

              let command = 'echo "Error Command"';
              const flags =
                (message.entry_file
                  ? ` --entryFile=${message.entry_file}`
                  : "") +
                (message.prefix ? ` --prefix=${message.prefix}` : "") +
                (path ? ` --projectRoot=${path}` : "") +
                (message.skip_install ? " --skipInstall" : "") +
                (message.skip_package_json ? " --skipPackageJson" : "") +
                (message.skip_ts_config ? " --skipTsConfig" : "") +
                (message.standalone ? " --standalone=false" : "") +
                (message.test_runner
                  ? ` --testRunner=${message.test_runner}`
                  : "");

              if (message.type === "ng") {
                command = `ng generate library ${name}` + flags;
              } else if (message.type === "nx") {
                command = `nx g @nx/angular:library ${name}` + flags;
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
  <title>Generate library</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <h2>Generate library for:</h2>
  <form id="myForm">
    <input type="hidden" name="command" value="angular-create-library">
    ${PathElement(pathUrl)}
    ${TypeElement()}
    ${NameElement("", "library")}
    ${EntryFileElement()}
    ${PrefixElement("lib")}
    ${SkipInstallElement()}
    ${SkipPackageJsonElement()}
    ${SkipTsConfigElement()}
    ${StandaloneElement()}
    ${TestRunnerElement()}

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
