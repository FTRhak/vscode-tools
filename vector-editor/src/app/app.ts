import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CoreModule } from '@vector-editor/core';
import { SharedModule } from '@vector-editor/shared';

@Component({
  imports: [RouterOutlet, CoreModule, SharedModule],
  selector: 'vector-editor-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('vector-editor');
}
