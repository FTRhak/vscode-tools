import { Component, input } from '@angular/core';
import { SceneObject } from '../../../../viewport/utils/scene';

@Component({
  selector: 'preview-svg',
  standalone: false,
  templateUrl: './preview-svg.html',
  styleUrl: './preview-svg.scss',
})
export class PreviewSvg {
  readonly viewBox = input.required<string>();
  readonly ratio = input.required<string>();
  readonly objects = input.required<readonly SceneObject[]>();
}
