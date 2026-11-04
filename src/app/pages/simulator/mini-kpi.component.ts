import { Component, input } from '@angular/core';
import { Motion } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

@Component({
  selector: 'ds-mini-kpi',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './mini-kpi.component.html',
})
export class MiniKpi {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input<number>();
  readonly unit = input<string>();
  readonly tone = input<'good' | 'bad'>();
  protected cn = cn;
}
