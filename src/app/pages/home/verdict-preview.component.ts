import { Component, computed, input } from '@angular/core';
import { Trophy } from 'lucide';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { type Run, EASE_OUT_EXPO } from './home.utils';

/** Aperçu stylisé de la page de résultats */
@Component({
  selector: 'ds-home-verdict-preview',
  imports: [Motion, Lucide],
  host: { style: 'display: contents' },
  templateUrl: './verdict-preview.component.html',
})
export class VerdictPreview {
  readonly run = input.required<Run>();
  protected I = { Trophy };
  protected cn = cn;
  protected ease = EASE_OUT_EXPO;
  protected pids = computed(() => Object.keys(this.run().base.harvestByParcel));
  protected stats = computed(() => {
    const r = this.run();
    const gain = r.pbi.revenue - r.base.revenue - r.pbi.totalCost;
    return [[`${r.pbi.globalHarvest.toFixed(0)} %`, 'récolte'], [`+${(gain / 1000).toFixed(1)} k€`, 'bilan / an'], [`${r.pbi.ift.toFixed(1)}`, 'IFT']];
  });
  protected round = (v: number) => Math.round(Number(v));
  protected barHeight = (v: number) => `${Math.max(2, Number(v) * 0.8)}%`;
}
