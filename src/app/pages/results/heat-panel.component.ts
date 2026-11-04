import { Component, computed, input } from '@angular/core';
import { MiniMap } from '@/components/grid-editor';
import { IsoOrchard } from '@/components/art';
import { type CellType, type StrategyResult } from '@/lib/engine';
import { peakMax } from './results.utils';

@Component({
  selector: 'ds-heat-panel',
  imports: [IsoOrchard, MiniMap],
  host: { style: 'display: contents' },
  templateUrl: './heat-panel.component.html',
})
export class HeatPanel {
  readonly focus = input.required<StrategyResult>();
  readonly base = input.required<StrategyResult>();
  readonly grid = input.required<CellType[]>();
  protected max = computed(() => peakMax(this.base()));
  protected maxLabel = computed(() => Math.round(this.max()).toLocaleString('fr-FR'));
}
