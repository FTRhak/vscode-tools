import { AlignEdge } from "@vector-editor/modules/align-objects";


export interface AlignAction {
  readonly edge: AlignEdge;
  readonly label: string;
  readonly icon: string;
}