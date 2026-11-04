import { Component, input, output } from '@angular/core';
import { Euro } from 'lucide';
import { Lucide } from '../ui/lucide';

@Component({
  selector: 'ds-number-field',
  imports: [Lucide],
  host: { style: 'display: contents' },
  templateUrl: './number-field.component.html',
})
export class NumberField {
  readonly label = input.required<string>();
  readonly unit = input.required<string>();
  readonly value = input.required<number>();
  readonly step = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly valueChange = output<number>();
  protected I = { Euro };
  protected onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    const clamped = Math.min(this.max(), Math.max(this.min(), v));
    this.valueChange.emit(clamped);
    // comme un champ contrôlé React : la valeur bornée s'affiche
    if (clamped !== v) el.value = String(clamped);
  }
}
