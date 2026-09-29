import { Component, input } from '@angular/core';

@Component({
  selector: 'preview-info',
  standalone: false,
  templateUrl: './preview-info.html',
  styleUrl: './preview-info.scss',
})
export class PreviewInfo {
  readonly viewBox = input.required<string>();
}
