import { EditorMode, EditorTool, HistoryState, SelectionState } from '@vector-editor/commands';
import { ImagePlacement } from './image-placement.model';
import { ViewportCamera } from './viewport-camera.model';
import { Document } from './document.model';

export class SessionSlice {
  readonly mode: EditorMode;
  readonly tool: EditorTool;
  readonly imagePlacement: ImagePlacement;
  readonly document: Document | null;
  readonly viewport: ViewportCamera;
  readonly selection: SelectionState;
  readonly history: HistoryState;
  readonly penObjectId: string | null;
  readonly selectedLayerId: string | null;

  constructor(data: SessionSlice) {
    this.mode = data.mode;
    this.tool = data.tool;
    this.imagePlacement = data.imagePlacement;
    this.document = data.document;
    this.viewport = data.viewport;
    this.selection = data.selection;
    this.history = data.history;
    this.penObjectId = data.penObjectId;
    this.selectedLayerId = data.selectedLayerId;
  }
}
