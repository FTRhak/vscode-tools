import type { Anchor } from './anchor.model';
import type { Segment } from './segment.model';

export interface Subpath {
  readonly closed: boolean;
  readonly anchors: readonly Anchor[];
  readonly segments: readonly Segment[];
}
