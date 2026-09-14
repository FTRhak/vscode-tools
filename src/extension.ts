import * as vscode from 'vscode';
import { angularCommands } from './angular';
import { reactCommands } from './react';

export function activate(context: vscode.ExtensionContext) {
	const showInfo = vscode.commands.registerCommand(
		'vscode-angular.openFileInfo',
		(resource: vscode.Uri) => {
			vscode.window.showInformationMessage(`File path: ${resource.fsPath}`);
		}
	);

	const openTerminal = vscode.commands.registerCommand(
		'vscode-angular.openInTerminal',
		(resource: vscode.Uri) => {
			const terminal = vscode.window.createTerminal("Explorer Terminal");
			terminal.sendText(`ls`);
			terminal.show();
		}
	);

	const angularCommandsList = angularCommands(context);
	const reactCommandsList = reactCommands(context);

	context.subscriptions.push(showInfo, openTerminal, ...angularCommandsList, ...reactCommandsList);
}


// This method is called when your extension is deactivated
export function deactivate() { }
