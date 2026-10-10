export interface Segment {
  readonly id: string;
  readonly kind: 'line' | 'cubic';
  readonly fromId: string;
  readonly toId: string;
}
