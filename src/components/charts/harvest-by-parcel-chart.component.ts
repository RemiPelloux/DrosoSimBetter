import { Component, computed, input } from '@angular/core';
import { isCherry, type SimOutput, type StrategyResult } from '@/lib/engine';
import type { Parcel, Strategy } from '@/lib/store';
import { ChartBase, ChartTooltip, DefaultTooltip, SvgAxis, SvgGrid, SvgText, barPositions, cartesianLabel, rectPath, type TipItem } from '../chartkit';
import { StrategyLegend } from './strategy-legend.component';
import { Empty } from './empty.component';
import { colorMap, nameMap, FALLBACK, categoryFrame, type BarSpec, bandIndex } from './charts.utils';

@Component({
  selector: 'ds-harvest-by-parcel-chart',
  imports: [SvgAxis, SvgGrid, SvgText, ChartTooltip, DefaultTooltip, StrategyLegend, Empty],
  host: { style: 'display: contents' },
  templateUrl: './harvest-by-parcel-chart.component.html',
})
export class HarvestByParcelChart extends ChartBase {
  readonly out = input.required<SimOutput>();
  readonly parcels = input.required<Parcel[]>();
  readonly strategies = input.required<Strategy[]>();
  readonly height = input(300);
  protected cursorFill = '#F1F5F9';
  protected cherry = computed(() => this.parcels().filter(p => isCherry(p.type)));
  private colors = computed(() => colorMap(this.strategies()));
  private names = computed(() => nameMap(this.out().results));
  private color(r: StrategyResult) { return r.isBaseline ? 'url(#hatchBase)' : this.colors().get(r.id) ?? FALLBACK; }

  protected g = computed(() => {
    const W = this.width(); if (!W) return null;
    const cherry = this.cherry(), results = this.out().results;
    const f = categoryFrame(W, this.height(), { top: 24, right: 8, left: -8, bottom: 4 }, 44, cherry.length > 2 ? 44 : 30, cherry.map(p => `🍒 ${p.name}`), [],
      { fixed: [0, 100], unit: '%', xFont: { fontSize: 10, fill: '#334155' }, wrap: true, interval0: true });
    const pos = barPositions(f.band, results.length, '22%');
    const series = results.map((r, k) => ({
      id: r.id,
      bars: cherry.map((p, i): BarSpec => {
        const v = r.harvestByParcel[p.id] ?? 0;
        const x = f.plot.x + f.band * i + pos[k].offset, w = pos[k].size;
        const y = f.ys(v), h = f.ys(0) - y;
        return {
          d: h === 0 || w === 0 ? null : rectPath(x, y, w, h, [4, 4, 0, 0]), fill: this.color(r),
          label: cartesianLabel(`${Math.round(Number(v))}%`, 'top', { x, y, width: w, height: h }, { fontSize: 10, fontWeight: 700, fill: r.isBaseline ? '#64748B' : this.colors().get(r.id) ?? FALLBACK }),
        };
      }),
    }));
    return { ...f, series };
  });
  protected activeIndex = computed(() => { const g = this.g(); return g ? bandIndex(this.mouse(), g.plot, g.band, this.cherry().length) : -1; });
  protected cursorPath = computed(() => { const g = this.g()!, i = this.activeIndex(); return rectPath(g.center(i) - g.band / 2, g.plot.y + 0.5, g.band, g.plot.height - 1); });
  protected tipCoord = computed(() => { const g = this.g(), i = this.activeIndex(), m = this.mouse(); return g && i >= 0 && m ? { x: g.center(i), y: m.y } : null; });
  protected tip = computed(() => {
    const i = this.activeIndex(); if (i < 0) return null;
    const p = this.cherry()[i];
    const items: TipItem[] = this.out().results.map(r => ({ name: this.names().get(r.id) ?? r.id, value: `${Number(r.harvestByParcel[p.id] ?? 0).toFixed(1)} %`, color: this.color(r) }));
    return { label: `🍒 ${p.name}`, items };
  });
}
