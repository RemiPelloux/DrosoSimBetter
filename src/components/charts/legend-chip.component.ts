import { Component, input, output } from '@angular/core';
import { cn } from '@/lib/utils';

// ============================================================ Dynamique
@Component({
  selector: 'ds-legend-chip',
  host: { style: 'display: contents' },
  templateUrl: './legend-chip.component.html',
})
export class LegendChip {
  readonly active = input.required<boolean>();
  readonly label = input.required<string>();
  readonly toggle = output<void>();
  protected cn = cn;
}
