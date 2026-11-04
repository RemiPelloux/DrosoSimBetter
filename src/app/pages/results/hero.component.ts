import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Trophy, ChevronDown, Settings2 } from 'lucide';
import { LiveBadge } from '@/components/app-header';
import { fmtEur } from '@/components/charts';
import { FlyingFlies } from '@/components/illustrations';
import { CountUp, Grain, Contours, IsoOrchard, HillsBackdrop } from '@/components/art';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { type SimSource } from '@/lib/simulation';
import { type CellType, type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { AnyIcon } from './any-icon.component';
import { type Chip, EASE, peakMax } from './results.utils';

@Component({
  selector: 'ds-hero',
  imports: [RouterLink, Motion, Lucide, AnyIcon, LiveBadge, CountUp, Contours, Grain, HillsBackdrop, FlyingFlies, IsoOrchard],
  host: { style: 'display: contents' },
  templateUrl: './hero.component.html',
})
export class Hero {
  readonly best = input<StrategyResult>();
  readonly net = input.required<number>();
  readonly base = input.required<StrategyResult>();
  readonly count = input.required<number>();
  readonly color = input.required<string>();
  readonly grid = input.required<CellType[]>();
  readonly chips = input.required<Chip[]>();
  readonly running = input.required<boolean>();
  readonly ms = input<number>();
  readonly source = input<SimSource>();
  readonly settingsOpen = input.required<boolean>();
  readonly toggleSettings = output<void>();

  protected I = { ArrowLeft, Trophy, Settings2, ChevronDown };
  protected cn = cn;
  protected fmtEur = fmtEur;
  protected abs = Math.abs;
  protected ease = EASE;
  protected view = signal<'best' | 'base'>('best');
  protected max = computed(() => peakMax(this.base()));
  protected shownRes = computed(() => (this.view() === 'best' && this.best() ? this.best()! : this.base()));
  protected gainPts = computed(() => { const b = this.best(); return b ? b.globalHarvest - this.base().globalHarvest : 0; });
}
