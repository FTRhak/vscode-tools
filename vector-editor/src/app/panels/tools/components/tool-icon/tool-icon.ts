import { Component, input } from '@angular/core';
import { EditorTool } from '@vector-editor/commands';

@Component({
  selector: 'tool-icon',
  template: `
    @switch (name()) {
      @case ('rectangle') {
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2.5" y="3.5" width="11" height="9" />
        </svg>
      }
      @case ('ellipse') {
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <ellipse cx="8" cy="8" rx="5.5" ry="4" />
        </svg>
      }
      @case ('star') {
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.6 9.7 6.1 14.4 6.3 10.7 9.2 12 13.8 8 11.2 4 13.8 5.3 9.2 1.6 6.3 6.3 6.1 Z" />
        </svg>
      }
      @case ('polygon') {
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2.2 13 5.1 13 10.9 8 13.8 3 10.9 3 5.1 Z" />
        </svg>
      }
      @case ('rhombus') {
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2 14 8 8 14 2 8 Z" />
        </svg>
      }
      @default {
        <i class="icon" [innerHTML]="glyph()"></i>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    svg {
      width: 1em;
      height: 1em;
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
  `,
})
export class ToolIcon {
  readonly name = input.required<EditorTool>();
  readonly glyph = input.required<string>();
}
