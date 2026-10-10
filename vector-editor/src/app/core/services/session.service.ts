import { computed, Service, signal } from '@angular/core';
import { Command } from '@vector-editor/commands';
import { captureClipperHold, ClipperHold } from '@vector-editor/modules/eval';
import { SessionSlice } from '@vector-editor/modules/types';
import { emptyHistory, emptySelection } from '../../commands/models/history';
import { commitSession } from './actions/commit-session';

const initialSession = new SessionSlice({
  mode: 'object',
  tool: 'select',
  imagePlacement: 'embed',
  document: null,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  selection: emptySelection,
  history: emptyHistory,
  penObjectId: null,
  selectedLayerId: null,
});

@Service()
export class SessionService {
  private readonly state = signal<SessionSlice>(initialSession);
  private readonly clipperHoldState = signal<ClipperHold | null>(null);

  readonly mode = computed(() => this.state().mode);
  readonly tool = computed(() => this.state().tool);
  readonly imagePlacement = computed(() => this.state().imagePlacement);
  readonly document = computed(() => this.state().document);
  readonly viewport = computed(() => this.state().viewport);
  readonly activeObjectId = computed(() => this.state().selection.activeObjectId);
  readonly selectedObjectIds = computed(() => this.state().selection.selectedObjectIds);
  readonly editSelectionKind = computed(() => this.state().selection.editSelectionKind);
  readonly selectedAnchorIds = computed(() => this.state().selection.selectedAnchorIds);
  readonly selectedSegmentIds = computed(() => this.state().selection.selectedSegmentIds);
  readonly history = computed(() => this.state().history);
  readonly canUndo = computed(() => this.state().history.index >= 0);
  readonly canRedo = computed(() => this.state().history.index < this.state().history.entries.length - 1);
  readonly penObjectId = computed(() => this.state().penObjectId);
  readonly selectedLayerId = computed(() => this.state().selectedLayerId);
  readonly clipperHold = this.clipperHoldState.asReadonly();

  apply(command: Command): void {
    this.state.update((current) => commitSession(current, command));
  }

  beginClipperHold(): void {
    if (this.clipperHoldState() !== null) {
      return;
    }
    const document = this.state().document;
    if (!document) {
      return;
    }
    this.clipperHoldState.set(captureClipperHold(document.objects));
  }

  endClipperHold(): void {
    if (this.clipperHoldState() === null) {
      return;
    }
    this.clipperHoldState.set(null);
  }
}
