import { Component, computed, input, output } from '@angular/core';
import { Trophy } from 'lucide';
import { fmtEur } from '@/components/charts';
import { IconFly } from '@/components/icons';
import { CountUp, RingGauge, Sparkline } from '@/components/art';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';

@Component({
  selector: 'ds-strategy-card',
  imports: [Motion, Lucide, CountUp, RingGauge, Sparkline, IconFly],
  host: { style: 'display: contents' },
  templateUrl: './strategy-card.component.html',
})
export class StrategyCard {
  readonly r = input.required<StrategyResult>();
  readonly base = input.required<StrategyResult>();
  readonly color = input.required<string>();
  readonly best = input.required<boolean>();
  readonly delay = input.required<number>();
  readonly focused = input.required<boolean>();
  readonly focus = output<void>();

  protected I = { Trophy };
  protected cn = cn;
  protected fmtEur = fmtEur;
  protected d = computed(() => this.r().globalHarvest - this.base().globalHarvest);
  protected net = computed(() => this.r().revenue - this.base().revenue - this.r().totalCost);
  protected peakDelta = computed(() => Math.round((this.r().peakDensity / Math.max(1, this.base().peakDensity) - 1) * 100));
  protected spark = computed(() => this.r().series.filter((_, i) => i % 3 === 0).map(p => Number(p['cherry_all']) || 0));
  protected c = computed(() => (this.r().isBaseline ? '#94A3B8' : this.color()));
  protected metric(tone: 'good' | 'bad' | 'neutral') {
    return cn('font-display text-base font-semibold tabular-nums', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-600' : 'text-slate-800');
  }
}
