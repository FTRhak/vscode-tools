import * as vscode from 'vscode';
import { angularCommands } from './tools/angular';
import { reactCommands } from './tools/react';
import { fontsCommands } from './tools/fonts-index';

const extensionTerminals: vscode.Terminal[] = [];

export function activate(context: vscode.ExtensionContext) {
	/*const showInfo = vscode.commands.registerCommand(
		'vscode-angular.openFileInfo',
		(resource: vscode.Uri) => {
			vscode.window.showInformationMessage(`File path: ${resource.fsPath}`);
		}
	);

	const openTerminal = vscode.commands.registerCommand(
		'vscode-angular.openInTerminal',
		(resource: vscode.Uri) => {
			const terminal = vscode.window.createTerminal("Explorer Terminal");
			extensionTerminals.push(terminal);
			terminal.sendText(`ls`);
			terminal.show();
		}
	);*/

	const angularCommandsList = angularCommands(context);
	const reactCommandsList = reactCommands(context);
	const fontPreviewCommandsList = fontsCommands(context);

	context.subscriptions.push(/*showInfo, openTerminal, */...angularCommandsList, ...reactCommandsList, ...fontPreviewCommandsList);
}


// This method is called when your extension is deactivated
export function deactivate() {
	for (const terminal of extensionTerminals) {
		terminal.dispose();
	}
	extensionTerminals.length = 0;
}
