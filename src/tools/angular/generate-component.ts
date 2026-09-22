import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import {
  AddTypeToClassNameElement,
  ChangeDetectionElement,
  DisplayBlockElement,
  ExportDefaultElement,
  ExportElement,
  FileTypeElement,
  InFolderElement,
  InlineStyleElement,
  InlineTemplateElement,
  ModuleElement,
  NameElement,
  NgHtmlElement,
  PathElement,
  PrefixElement,
  ProjectElement,
  SelectorElement,
  SkipImportModuleElement,
  SkipSelectorElement,
  SkipTestsElement,
  StandaloneElement,
  StylesElement,
  SufixElement,
  TypeElement,
  ViewEncapsulationElement,
} from "../../shared/form_elements/index";

export function angularCommandGenerateComponent(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  let commands: vscode.Disposable[] = [];

  // Command to create a new Angular component (placeholder implementation)
  commands.push(
    vscode.commands.registerCommand(
      "vscode-angular.createAngularComponent",
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
          "formPageGenerateAngularComponent", // internal ID
          "Angular Generate Component", // tab title
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
            if (message.command === "angular-create-component") {
              let path = message.path;
              let name = message.name
                .split(/(?=[A-Z])/)
                .join("_")
                .toLowerCase();
              let in_folder = !!message.in_folder;
              const sufix = !!message.sufix;

              vscode.window.showInformationMessage(
                `Generating Component: ${name}`,
              );

              let command = 'echo "Error Command"';
              const flags =
                (!message.add_type_to_class_name
                  ? " --addTypeToClassName=false"
                  : "") +
                (message.display_block ? " --displayBlock" : "") +
                (message.export ? " --export" : "") +
                (message.export_default ? " --exportDefault" : "") +
                (message.standalone ? " --standalone=false" : "") +
                (message.inline_style ? " --inlineStyle" : "") +
                (message.inline_template ? " --inlineTemplate" : "") +
                (message.ng_html ? " --ngHtml" : "") +
                (message.skip_tests ? " --skipTests" : "") +
                (message.skip_selector ? " --skipSelector" : "") +
                (message.skip_import_module ? " --skipImport" : "") +
                (message.prefix ? ` --prefix=${message.prefix}` : "") +
                (message.project ? ` --project=${message.project}` : "") +
                (message.selector ? ` --selector=${message.selector}` : "") +
                (message.style ? ` --style=${message.style}` : "") +
                (message.file_type ? ` --type=${message.file_type}` : "") +
                (message.module ? ` --module=${message.module}` : "") +
                (message.change_detection
                  ? ` --changeDetection=${message.change_detection}`
                  : "") +
                (message.view_encapsulation
                  ? ` --viewEncapsulation=${message.view_encapsulation}`
                  : "");
              const target = `${path}/${in_folder ? name + "/" : ""}${name}${sufix ? ".component" : ""}`;

              if (message.type === "ng") {
                command = `ng generate component ${target}` + flags;
              } else if (message.type === "nx") {
                command = `nx g @nx/angular:component ${target}` + flags;
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
  <title>Generate component</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body class="vscode-angular">
  <div class="container">
    <h2>Generate component for:</h2>
    <form id="myForm">
      <input type="hidden" name="command" value="angular-create-component">
      ${PathElement(pathUrl)}
      ${TypeElement()}
      ${NameElement("", "component")}
      ${ProjectElement()}
      ${PrefixElement("")}
      ${SelectorElement()}
      ${FileTypeElement()}
      ${AddTypeToClassNameElement(true)}
      ${InFolderElement(true)}
      ${SufixElement(true, "component")}
      ${StandaloneElement()}
      ${ChangeDetectionElement()}
      ${ViewEncapsulationElement()}
      <fieldset class="form-group-card">
        <legend class="card-title">View Options</legend>
        ${InlineStyleElement()}
        ${InlineTemplateElement()}
        ${StylesElement(true)}
        ${DisplayBlockElement()}
        ${NgHtmlElement()}
      </fieldset>
      <fieldset class="form-group-card">
        <legend class="card-title">Skip Options</legend>
        ${SkipTestsElement()}
        ${SkipImportModuleElement()}
        ${SkipSelectorElement()}
      </fieldset>
      <fieldset class="form-group-card">
        <legend class="card-title">Module Options</legend>
        ${ModuleElement()}
        ${ExportElement()}
        ${ExportDefaultElement()}
      </fieldset>
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
