import type { TraceFault } from './trace-fault.model';
import type { TraceMode } from './trace-mode.model';
import type { TraceRegion } from './trace-region.model';
import type { TraceView } from './trace-view.model';

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
      readonly axis: 'x' | 'y' | 'xy' | 'none';
      readonly centerPointId?: string;
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
    }
  | {
      readonly id: string;
      readonly type: 'trace';
      readonly mode: TraceMode;
      readonly colors: number;
      readonly threshold: number;
      readonly paths: number;
      readonly corners: number;
      readonly noise: number;
      readonly optimization: number;
      readonly ignoreWhite: boolean;
      readonly view: TraceView;
      readonly regions: readonly TraceRegion[];
      readonly fault?: TraceFault;
      readonly enabled: boolean;
    };
