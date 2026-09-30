import { OutlinerObject } from './outliner-object.model';

export interface OutlinerLayer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly index: number;
  readonly canMoveForward: boolean;
  readonly canMoveBackward: boolean;
  readonly objects: readonly OutlinerObject[];
}
