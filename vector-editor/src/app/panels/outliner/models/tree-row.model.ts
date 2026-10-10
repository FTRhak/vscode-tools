export interface TreeRow {
  readonly key: string;
  readonly kind: 'layer' | 'object';
  readonly id: string;
}
