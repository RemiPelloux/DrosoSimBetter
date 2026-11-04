import { Component, computed, input } from '@angular/core';
import { isCherry, type StrategyResult } from '@/lib/engine';
import type { Parcel } from '@/lib/store';
import { ChartBase, ChartTooltip, DefaultTooltip, SvgAxis, SvgGrid, SvgText, barPositions, cartesianLabel, rectPath, type TipItem } from '../chartkit';
import { Empty } from './empty.component';
import { categoryFrame, type BarSpec, bandIndex } from './charts.utils';

// ============================================================ Récolte par année
@Component({
  selector: 'ds-yearly-harvest-chart',
  imports: [SvgAxis, SvgGrid, SvgText, ChartTooltip, DefaultTooltip, Empty],
  host: { style: 'display: contents' },
  templateUrl: './yearly-harvest-chart.component.html',
})
export class YearlyHarvestChart extends ChartBase {
  readonly result = input.required<StrategyResult>();
  readonly parcels = input.required<Parcel[]>();
  readonly height = input(220);
  protected cursorFill = '#ccc';
  private cherry = computed(() => this.parcels().filter(p => isCherry(p.type)));
  protected years = computed(() => Math.max(0, ...this.cherry().map(p => this.result().harvestByParcelYear[p.id]?.length ?? 0)));
  private val(id: string, y: number) { return Math.round(this.result().harvestByParcelYear[id]?.[y] ?? 0); }

  protected g = computed(() => {
    const W = this.width(); if (!W || !this.years()) return null;
    const cherry = this.cherry(), years = this.years();
    const cats = Array.from({ length: years }, (_, y) => `Année ${y + 1}`);
    const f = categoryFrame(W, this.height(), { top: 18, right: 8, left: -12, bottom: 0 }, 60, 30, cats, [], { fixed: [0, 100], unit: '%', xFont: { fontSize: 11, fill: '#334155' } });
    const pos = barPositions(f.band, cherry.length, '10%');
    const series = cherry.map((p, k) => ({
      id: p.id,
      bars: cats.map((_, i): BarSpec => {
        const v = this.val(p.id, i);
        const x = f.plot.x + f.band * i + pos[k].offset, w = pos[k].size;
        const y = f.ys(v), h = f.ys(0) - y;
        return { d: h === 0 || w === 0 ? null : rectPath(x, y, w, h, [3, 3, 0, 0]), fill: p.color, label: cartesianLabel(`${v}%`, 'top', { x, y, width: w, height: h }, { fontSize: 9, fill: '#334155', fontWeight: 700 }) };
      }),
    }));
    return { ...f, series };
  });
  protected activeIndex = computed(() => { const g = this.g(); return g ? bandIndex(this.mouse(), g.plot, g.band, this.years()) : -1; });
  protected cursorPath = computed(() => { const g = this.g()!, i = this.activeIndex(); return rectPath(g.center(i) - g.band / 2, g.plot.y + 0.5, g.band, g.plot.height - 1); });
  protected tipCoord = computed(() => { const g = this.g(), i = this.activeIndex(), m = this.mouse(); return g && i >= 0 && m ? { x: g.center(i), y: m.y } : null; });
  protected tip = computed(() => {
    const i = this.activeIndex(); if (i < 0) return null;
    const items: TipItem[] = this.cherry().map(p => ({ name: p.name, value: `${this.val(p.id, i)} %`, color: p.color }));
    return { label: `Année ${i + 1}`, items };
  });
}
