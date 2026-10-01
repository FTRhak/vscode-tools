export interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface ViewportCamera {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

export interface Anchor {
  readonly id: string;
  readonly position: Vec2;
  readonly handleIn: Vec2 | null;
  readonly handleOut: Vec2 | null;
}

export interface Segment {
  readonly id: string;
  readonly kind: 'line' | 'cubic';
  readonly fromId: string;
  readonly toId: string;
}

export interface Subpath {
  readonly closed: boolean;
  readonly anchors: readonly Anchor[];
  readonly segments: readonly Segment[];
}

export interface SourcePath {
  readonly subpaths: readonly Subpath[];
}

export interface ObjectTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly originX: number;
  readonly originY: number;
}

export interface Style {
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly strokeWidth: number;
  readonly fillRule: 'nonzero' | 'evenodd';
}

export type Modifier =
  | {
      readonly id: string;
      readonly type: 'array';
      readonly count: number;
      readonly offsetX: number;
      readonly offsetY: number;
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: 'mirror';
      readonly axis: 'x' | 'y' | 'xy';
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: 'bevel';
      readonly distance: number;
      readonly join: 'bevel' | 'miter' | 'round';
      readonly miterLimit: number;
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: 'round';
      readonly mode: 'direct' | 'smooth' | 'circle';
      readonly anchorCount: number;
      readonly roundness: number;
      readonly enabled: boolean;
    }
  | {
      readonly id: string;
      readonly type: 'boolean';
      readonly operation: 'union' | 'difference' | 'intersect';
      readonly operandId: string;
      readonly enabled: boolean;
    };

export interface VectorObject {
  readonly id: string;
  readonly name: string;
  readonly layerId: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly source: SourcePath;
  readonly style: Style;
  readonly transform: ObjectTransform;
  readonly modifiers: readonly Modifier[];
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly order: number;
}

export interface Swatch {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export type GradientType = 'linear' | 'radial';

export interface GradientStop {
  readonly id: string;
  readonly offset: number;
  readonly color: string;
  readonly opacity: number;
}

export interface Gradient {
  readonly id: string;
  readonly name: string;
  readonly type: GradientType;
  readonly angle: number;
  readonly proportions: number;
  readonly stops: readonly GradientStop[];
}

export interface Document {
  readonly id: string;
  readonly name: string;
  readonly viewBox: ViewBox;
  readonly layers: readonly Layer[];
  readonly objects: readonly VectorObject[];
  readonly swatches: readonly Swatch[];
  readonly gradients: readonly Gradient[];
}
