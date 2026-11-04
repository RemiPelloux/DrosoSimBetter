import { Component, computed, input } from '@angular/core';
import { curveStepAfter } from 'd3-shape';
import { dayLabel, isCherry, type SimOutput } from '@/lib/engine';
import type { Parcel, Strategy } from '@/lib/store';
import { ChartBase, ChartTooltip, DefaultTooltip, SvgAxis, SvgGrid } from '../chartkit';
import { colorMap, dayFrame, pathOf, num, lineActive, nameMap } from './charts.utils';

// ============================================================ Évolution des fruits sains
@Component({
  selector: 'ds-healthy-fruit-chart',
  imports: [SvgAxis, SvgGrid, ChartTooltip, DefaultTooltip],
  host: { style: 'display: contents' },
  templateUrl: './healthy-fruit-chart.component.html',
})
export class HealthyFruitChart extends ChartBase {
  readonly out = input.required<SimOutput>();
  readonly parcels = input.required<Parcel[]>();
  readonly strategies = input.required<Strategy[]>();
  readonly height = input(260);
  private cherry = computed(() => this.parcels().filter(p => isCherry(p.type)));
  private rows = computed(() => {
    const out = this.out(), cherry = this.cherry();
    return out.results[0]?.damageSeries.map((p, i) => {
      const row: Record<string, number> = { day: p.day };
      out.results.forEach(r => {
        let s = 0, n = 0;
        cherry.forEach(c => { const v = r.damageSeries[i]?.[c.id]; if (typeof v === 'number') { s += v * c.area; n += c.area; } });
        row[r.id] = n ? s / n : 100;
      });
      return row;
    }) ?? [];
  });
  protected g = computed(() => {
    const W = this.width(); if (!W) return null;
    const out = this.out(), rows = this.rows(), colors = colorMap(this.strategies());
    const f = dayFrame(W, this.height(), { top: 10, right: 16, left: -8, bottom: 0 }, 60, out, [], { fixed: [0, 100], unit: '%', xFmt: d => dayLabel(d, out.startDayOfYear).month });
    const lines = out.results.map(r => ({
      id: r.id, color: colors.get(r.id) ?? '#3182bd', width: 2, dash: r.isBaseline ? '5 4' : null,
      d: pathOf(rows.map(row => [f.xs(row['day']), num(row[r.id]) === null ? null : f.ys(row[r.id])]), curveStepAfter),
    }));
    return { ...f, lines, xsData: rows.map(r => f.xs(r['day'])) };
  });
  protected active = computed(() => lineActive(this.g(), this.mouse(), this.rows(), this.out(), v => `${Number(v).toFixed(1)} % de fruits sains`, nameMap(this.out().results)));
}
