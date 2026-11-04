import { Component, input, output } from '@angular/core';
import { type StrategyResult } from '@/lib/engine';
import type { ColorFn } from './results.utils';

@Component({
  selector: 'ds-focus-picker',
  host: { style: 'display: contents' },
  templateUrl: './focus-picker.component.html',
})
export class FocusPicker {
  readonly results = input.required<StrategyResult[]>();
  readonly value = input<string>();
  readonly color = input.required<ColorFn>();
  readonly valueChange = output<string>();
  protected pick(e: Event) { this.valueChange.emit((e.target as HTMLSelectElement).value); }
}
