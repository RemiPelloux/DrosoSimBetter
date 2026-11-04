import { Component, computed, input } from '@angular/core';
import { curveMonotoneX } from 'd3-shape';
import { dayLabel, type SimOutput } from '@/lib/engine';
import type { Strategy } from '@/lib/store';
import { ChartBase, ChartTooltip, DefaultTooltip, SvgAxis, SvgGrid, rectPath } from '../chartkit';
import { colorMap, num, dayFrame, kFmt, phenoBands, THRESHOLD, pathOf, lineActive, fmt, nameMap } from './charts.utils';

@Component({
  selector: 'ds-overlay-chart',
  imports: [SvgAxis, SvgGrid, ChartTooltip, DefaultTooltip],
  host: { style: 'display: contents' },
  templateUrl: './overlay-chart.component.html',
})
export class OverlayChart extends ChartBase {
  readonly out = input.required<SimOutput>();
  readonly strategies = input.required<Strategy[]>();
  readonly height = input(280);
  private rows = computed(() => {
    const out = this.out();
    return out.results[0]?.series.map((p, i) => {
      const row: Record<string, number> = { day: p.day };
      out.results.forEach(r => (row[r.id] = r.series[i]?.['cherry_all'] as number));
      return row;
    }) ?? [];
  });
  protected g = computed(() => {
    const W = this.width(); if (!W) return null;
    const out = this.out(), rows = this.rows(), colors = colorMap(this.strategies());
    const values: number[] = [];
    for (const r of rows) for (const s of out.results) { const v = num(r[s.id]); if (v !== null) values.push(v); }
    const f = dayFrame(W, this.height(), { top: 10, right: 16, left: 4, bottom: 0 }, 40, out, values, { yFmt: kFmt, xFmt: d => dayLabel(d, out.startDayOfYear).month });
    const bands = phenoBands(out).map(b => { const x1 = f.xs(b.x1), x2 = f.xs(b.x2); return rectPath(Math.min(x1, x2), f.plot.y, Math.abs(x2 - x1), f.plot.height); });
    const threshold = THRESHOLD >= f.domain[0] && THRESHOLD <= f.domain[1] ? f.ys(THRESHOLD) : null;
    const lines = out.results.map(r => ({
      id: r.id, color: colors.get(r.id) ?? '#3182bd', width: r.isBaseline ? 2 : 2.5, dash: r.isBaseline ? '5 4' : null,
      d: pathOf(rows.map(row => [f.xs(row['day']), num(row[r.id]) === null ? null : f.ys(row[r.id])]), curveMonotoneX),
    }));
    return { ...f, bands, threshold, lines, xsData: rows.map(r => f.xs(r['day'])) };
  });
  protected active = computed(() => lineActive(this.g(), this.mouse(), this.rows(), this.out(), v => `${fmt(Number(v))} femelles/ha`, nameMap(this.out().results)));
}
