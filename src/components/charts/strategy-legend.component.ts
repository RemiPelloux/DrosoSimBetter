import { Component, computed, input } from '@angular/core';
import { type StrategyResult } from '@/lib/engine';
import type { Strategy } from '@/lib/store';
import { cn } from '@/lib/utils';
import { colorMap } from './charts.utils';

@Component({
  selector: 'ds-strategy-legend',
  host: { style: 'display: contents' },
  templateUrl: './strategy-legend.component.html',
})
export class StrategyLegend {
  readonly results = input.required<StrategyResult[]>();
  readonly strategies = input.required<Strategy[]>();
  protected colors = computed(() => colorMap(this.strategies()));
  protected cn = cn;
}
