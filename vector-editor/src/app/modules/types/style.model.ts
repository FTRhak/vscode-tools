import type { StrokeAlign } from './stroke-align.model';
import type { StrokeLinecap } from './stroke-linecap.model';
import type { StrokeLinejoin } from './stroke-join.model';

export interface Style {
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly strokeWidth: number;
  readonly strokeLinecap: StrokeLinecap;
  readonly strokeLinejoin: StrokeLinejoin;
  readonly strokeMiterlimit: number;
  readonly strokeOpacity: number;
  readonly strokeDashoffset: number;
  readonly strokeDasharray: readonly number[] | null;
  readonly strokeAlign: StrokeAlign;
  readonly fillRule: 'nonzero' | 'evenodd';
}

export const svgStrokeDefaults: Pick<
  Style,
  'strokeLinecap' | 'strokeLinejoin' | 'strokeMiterlimit' | 'strokeOpacity' | 'strokeDashoffset' | 'strokeDasharray' | 'strokeAlign'
> = {
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
  strokeMiterlimit: 4,
  strokeOpacity: 1,
  strokeDashoffset: 0,
  strokeDasharray: null,
  strokeAlign: 'default',
};
