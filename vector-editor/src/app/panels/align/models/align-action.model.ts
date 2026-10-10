import { AlignEdge } from "@vector-editor/core";

export interface AlignAction {
  readonly edge: AlignEdge;
  readonly label: string;
  readonly icon: string;
}