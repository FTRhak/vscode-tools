import type { GradientStop } from './gradient-stop.model';
import type { GradientType } from './gradient-type.model';

export interface Gradient {
  readonly id: string;
  readonly name: string;
  readonly type: GradientType;
  readonly angle: number;
  readonly proportions: number;
  readonly stops: readonly GradientStop[];
}
