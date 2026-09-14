import * as vscode from 'vscode';

import { angularCommandGenerateApplication } from './angular/generate-application';
import { angularCommandGenerateClass } from './angular/generate-class';
import { angularCommandGenerateComponent } from './angular/generate-component';
import { angularCommandGenerateDirective } from './angular/generate-directive';
import { angularCommandGenerateEnvironment } from './angular/generate-environment';
import { angularCommandGenerateLibrary } from './angular/generate-library';
import { angularCommandGenerateModule } from './angular/generate-module';
import { angularCommandGeneratePipe } from './angular/generate-pipe';
import { angularCommandGenerateService } from './angular/generate-service';

export function angularCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    let commands: vscode.Disposable[] = [];

    // Command to create a new Angular elements (placeholder implementation)
    // https://nx.dev/docs/technologies/angular/generators#application
    commands = commands.concat(
        ...angularCommandGenerateApplication(context),
        ...angularCommandGenerateClass(context),
        ...angularCommandGenerateComponent(context),
        ...angularCommandGenerateDirective(context),
        ...angularCommandGenerateEnvironment(context),
        ...angularCommandGenerateLibrary(context),
        ...angularCommandGenerateModule(context),
        ...angularCommandGeneratePipe(context),
        ...angularCommandGenerateService(context)
    );

    return commands;
}