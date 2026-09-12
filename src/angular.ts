import * as vscode from 'vscode';

import { angularCommandGenerateApplication } from './angular/generate-application';
import { angularCommandGenerateComponent } from './angular/generate-component';
import { angularCommandGenerateDirective } from './angular/generate-directive';
import { angularCommandGeneratePipe } from './angular/generate-pipe';

export function angularCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    let commands: vscode.Disposable[] = [];

    // Command to create a new Angular elements (placeholder implementation)
    // https://nx.dev/docs/technologies/angular/generators#application
    commands = commands.concat(
        ...angularCommandGenerateApplication(context),
        ...angularCommandGenerateComponent(context),
        ...angularCommandGenerateDirective(context),
        ...angularCommandGeneratePipe(context)
    );

    return commands;
}