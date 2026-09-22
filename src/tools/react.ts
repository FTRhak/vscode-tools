import * as vscode from 'vscode';

import { reactCommandGenerateComponent } from './react/generate-component';

export function reactCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    let commands: vscode.Disposable[] = [];

    commands = commands.concat(
        ...reactCommandGenerateComponent(context)
    );

    return commands;
}
