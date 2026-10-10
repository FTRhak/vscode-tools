import type { Vec2 } from './vec2.model';

export interface Anchor {
  readonly id: string;
  readonly position: Vec2;
  readonly handleIn: Vec2 | null;
  readonly handleOut: Vec2 | null;
}
