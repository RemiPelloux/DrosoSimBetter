import { Component, computed, input } from '@angular/core';
import { CountUp } from '@/components/art';
import { Motion } from '@/components/ui/motion';
import { type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { type ColorFn, EASE } from './results.utils';

@Component({
  selector: 'ds-podium',
  imports: [Motion, CountUp],
  host: { style: 'display: contents' },
  templateUrl: './podium.component.html',
})
export class Podium {
  readonly ranked = input.required<{ r: StrategyResult; net: number }[]>();
  readonly color = input.required<ColorFn>();
  readonly base = input.required<StrategyResult>();
  protected cn = cn;
  protected ease = EASE;
  private maxAbs = computed(() => Math.max(1, ...this.ranked().map(x => Math.abs(x.net))));
  protected barWidth(net: number) { return `${Math.max(3, (Math.abs(net) / this.maxAbs()) * 100)}%`; }
}
