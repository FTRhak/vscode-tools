import * as vscode from 'vscode';

import { angularCommandGenerateApplication } from './angular/generate-application';
import { angularCommandGenerateClass } from './angular/generate-class';
import { angularCommandGenerateComponent } from './angular/generate-component';
import { angularCommandGenerateConfig } from './angular/generate-config';
import { angularCommandGenerateDirective } from './angular/generate-directive';
import { angularCommandGenerateEnvironment } from './angular/generate-environment';
import { angularCommandGenerateGuard } from './angular/generate-guard';
import { angularCommandGenerateInterceptor } from './angular/generate-interceptor';
import { angularCommandGenerateLibrary } from './angular/generate-library';
import { angularCommandGenerateModule } from './angular/generate-module';
import { angularCommandGeneratePipe } from './angular/generate-pipe';
import { angularCommandGenerateResolver } from './angular/generate-resolver';
import { angularCommandGenerateService } from './angular/generate-service';
import { angularCommandGenerateServiceWorker } from './angular/generate-service-worker';
import { angularCommandGenerateWebWorker } from './angular/generate-web-worker';

export function angularCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    let commands: vscode.Disposable[] = [];

    // Command to create a new Angular elements (placeholder implementation)
    // https://nx.dev/docs/technologies/angular/generators#application
    commands = commands.concat(
        ...angularCommandGenerateApplication(context),
        ...angularCommandGenerateClass(context),
        ...angularCommandGenerateComponent(context),
        ...angularCommandGenerateConfig(context),
        ...angularCommandGenerateDirective(context),
        ...angularCommandGenerateEnvironment(context),
        ...angularCommandGenerateGuard(context),
        ...angularCommandGenerateInterceptor(context),
        ...angularCommandGenerateLibrary(context),
        ...angularCommandGenerateModule(context),
        ...angularCommandGeneratePipe(context),
        ...angularCommandGenerateResolver(context),
        ...angularCommandGenerateService(context),
        ...angularCommandGenerateServiceWorker(context),
        ...angularCommandGenerateWebWorker(context)
    );

    return commands;
}