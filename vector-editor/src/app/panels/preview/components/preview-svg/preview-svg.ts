import { Component, input } from '@angular/core';
import { gradientTransform, SceneObject } from '../../../../viewport/utils/scene';
import { Gradient } from '@vector-editor/modules/types';

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
  readonly gradients = input.required<readonly Gradient[]>();

  protected gradientTransform = gradientTransform;
}
