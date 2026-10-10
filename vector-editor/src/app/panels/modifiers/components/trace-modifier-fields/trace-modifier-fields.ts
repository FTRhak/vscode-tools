import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { form } from '@angular/forms/signals';
import { tracePresets, TraceSettings } from '@vector-editor/modules/image-trace/image-trace';
import { Modifier, TraceMode, TraceView } from '@vector-editor/modules/types/types';

type TraceModifier = Extract<Modifier, { type: 'trace' }>;

interface TraceDraft {
  readonly colors: number | null;
  readonly threshold: number | null;
  readonly paths: number | null;
  readonly corners: number | null;
  readonly noise: number | null;
}

export interface TraceModifierPatch {
  readonly traceMode?: TraceMode;
  readonly colors?: number;
  readonly threshold?: number;
  readonly paths?: number;
  readonly corners?: number;
  readonly noise?: number;
  readonly optimization?: number;
  readonly ignoreWhite?: boolean;
  readonly view?: TraceView;
}

type NumberKey = 'colors' | 'threshold' | 'paths' | 'corners' | 'noise';

@Component({
  selector: 'trace-modifier-fields',
  standalone: false,
  templateUrl: './trace-modifier-fields.html',
  styleUrl: './trace-modifier-fields.scss',
})
export class TraceModifierFields {
  readonly modifier = input.required<TraceModifier>();
  readonly committed = output<TraceModifierPatch>();

  protected readonly presets = tracePresets;

  private readonly draftSource = computed(
    () => ({
      colors: this.modifier().colors,
      threshold: this.modifier().threshold,
      paths: this.modifier().paths,
      corners: this.modifier().corners,
      noise: this.modifier().noise,
    }),
    { equal: sameDraft },
  );

  protected readonly draft = linkedSignal(() => this.draftSource());
  protected readonly traceForm = form(this.draft);

  protected readonly presetId = computed(() => {
    const modifier = this.modifier();
    return tracePresets.find((preset) => sameSettings(preset, modifier))?.id ?? '';
  });

  protected commitPreset(event: Event): void {
    const selected = event.target instanceof HTMLSelectElement ? event.target.value : '';
    const preset = tracePresets.find((item) => item.id === selected);
    if (!preset || sameSettings(preset, this.modifier())) {
      return;
    }
    this.committed.emit({
      traceMode: preset.mode,
      colors: preset.colors,
      threshold: preset.threshold,
      paths: preset.paths,
      corners: preset.corners,
      noise: preset.noise,
      optimization: preset.optimization,
      ignoreWhite: preset.ignoreWhite,
    });
  }

  protected commitView(view: TraceView): void {
    if (view !== this.modifier().view) {
      this.committed.emit({ view });
    }
  }

  protected commitMode(mode: TraceMode): void {
    if (mode !== this.modifier().mode) {
      this.committed.emit({ traceMode: mode });
    }
  }

  protected commitIgnore(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    if (event.target.checked !== this.modifier().ignoreWhite) {
      this.committed.emit({ ignoreWhite: event.target.checked });
    }
  }

  protected commitOptimization(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const value = Number(event.target.value);
    if (Number.isInteger(value) && value !== this.modifier().optimization) {
      this.committed.emit({ optimization: value });
    }
  }

  protected commitNumber(key: NumberKey, event?: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    const value = this.draft()[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value === this.modifier()[key]) {
      return;
    }
    this.committed.emit({ [key]: value });
  }
}

function sameDraft(left: TraceDraft, right: TraceDraft): boolean {
  return (
    left.colors === right.colors &&
    left.threshold === right.threshold &&
    left.paths === right.paths &&
    left.corners === right.corners &&
    left.noise === right.noise
  );
}

function sameSettings(preset: TraceSettings, modifier: TraceModifier): boolean {
  return (
    preset.mode === modifier.mode &&
    preset.colors === modifier.colors &&
    preset.threshold === modifier.threshold &&
    preset.paths === modifier.paths &&
    preset.corners === modifier.corners &&
    preset.noise === modifier.noise &&
    preset.optimization === modifier.optimization &&
    preset.ignoreWhite === modifier.ignoreWhite
  );
}
