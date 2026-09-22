import * as vscode from 'vscode';
import { registerFontPreviewCommand } from './fonts/font-preview-page';

export function fontsCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    let commands: vscode.Disposable[] = [];

    commands = commands.concat(
        ...registerFontPreviewCommand(context),
    );

    return commands;
}