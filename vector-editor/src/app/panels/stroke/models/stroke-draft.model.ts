export interface StrokeDraft {
  readonly strokeWidth: number | null;
  readonly strokeMiterlimit: number | null;
  readonly strokeOpacity: number | null;
  readonly strokeDashoffset: number | null;
  readonly strokeDasharray: string;
}