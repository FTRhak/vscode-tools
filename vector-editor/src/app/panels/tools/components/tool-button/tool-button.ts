import { Component, input, output } from '@angular/core';
import { EditorTool, EditorToolDefinition } from '@vector-editor/commands';

@Component({
  selector: 'tool-button',
  standalone: false,
  template: `
    <button
      type="button"
      class="chrome-button tool-button"
      [attr.title]="tool().label"
      [attr.aria-label]="tool().label"
      [attr.aria-keyshortcuts]="tool().shortcut"
      [attr.aria-pressed]="active() ? 'true' : 'false'"
      (click)="selected.emit(tool().id)"
    >
      <i class="icon" [innerHTML]="icon()"></i>
      <span>{{ tool().label }}</span>
      <span class="shortcut" title="Shortcut: {{ tool().shortcut }}">{{ tool().shortcut }}</span>
    </button>
  `,
  styles: `
    .tool-button {
      width: 100%;
      align-items: center;
    }
  `,
})
export class ToolButton {
  readonly tool = input.required<EditorToolDefinition>();
  readonly icon = input.required<string>();
  readonly active = input(false);
  readonly selected = output<EditorTool>();
}