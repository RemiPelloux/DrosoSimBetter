import { Component, ElementRef, afterRenderEffect, computed, input, signal, untracked, viewChild } from '@angular/core';
import { curveLinear } from 'd3-shape';
import { type SimOutput } from '@/lib/engine';
import type { Strategy } from '@/lib/store';
import { ChartBase, ChartTooltip, DefaultTooltip, SvgAxis, SvgGrid, barPositions, rectPath, type TipItem } from '../chartkit';
import { categoryFrame, pathOf, bandIndex } from './charts.utils';

export const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

// ============================================================ Économie
const ECO_KEYS = ['gain', 'net', 'phyto', 'labor', 'bio', 'tis'] as const;
const ECO_FILL: Record<string, string> = { gain: '#16A34A', net: '#2563EB', phyto: '#D97706', labor: '#0D9488', bio: '#7C3AED', tis: '#DB2777', balance: '#0F172A' };
const ECO_TIP: Record<string, string> = { gain: 'CA sauvé vs témoin', net: 'Filets', phyto: 'Produits phyto / bio', labor: 'Main-d’œuvre', bio: 'Parasitoïdes', tis: 'TIS', balance: 'Bilan net' };
const ECO_LEGEND: Record<string, string> = { gain: 'CA sauvé', net: 'Filets', phyto: 'Phyto/bio', labor: 'Main-d’œuvre', bio: 'Parasitoïdes', tis: 'TIS', balance: 'Bilan net' };

@Component({
  selector: 'ds-economics-chart',
  imports: [SvgAxis, SvgGrid, ChartTooltip, DefaultTooltip],
  host: { style: 'display: contents' },
  templateUrl: './economics-chart.component.html',
})
export class EconomicsChart extends ChartBase {
  readonly out = input.required<SimOutput>();
  readonly strategies = input.required<Strategy[]>();
  readonly height = input(280);
  protected fill = ECO_FILL;
  protected legendLabels = ECO_LEGEND;
  // ordre de la légende Recharts par défaut : tri par dataKey
  protected legendKeys = [...ECO_KEYS, 'balance'].sort();
  private legendEl = viewChild<ElementRef<HTMLDivElement>>('legend');
  private legendH = signal(0);

  constructor() {
    super();
    // la hauteur de la légende réduit la zone de tracé (comme Recharts)
    afterRenderEffect(() => {
      this.g();
      const el = this.legendEl()?.nativeElement;
      const h = el ? el.getBoundingClientRect().height : 0;
      if (h !== untracked(this.legendH)) this.legendH.set(h);
    });
  }

  private data = computed(() => {
    const out = this.out();
    const base = out.results.find(r => r.isBaseline);
    return out.results.map(r => ({
      name: r.isBaseline ? 'Témoin' : r.name,
      id: r.id,
      gain: Math.max(0, r.revenue - (base?.revenue ?? 0)),
      net: -r.costs.net, phyto: -r.costs.phyto, labor: -r.costs.labor, bio: -r.costs.bio, tis: -r.costs.tis,
      balance: r.revenue - (base?.revenue ?? 0) - r.totalCost,
    }));
  });

  protected g = computed(() => {
    const W = this.width(); if (!W) return null;
    const data = this.data();
    // empilement « sign » : positifs vers le haut, négatifs vers le bas
    const stacks = data.map(d => {
      let pos = 0, neg = 0;
      const seg: Record<string, [number, number]> = {};
      for (const k of ECO_KEYS) {
        const v = d[k];
        if (v >= 0) { seg[k] = [pos, pos + v]; pos += v; } else { seg[k] = [neg + v, neg]; neg += v; }
      }
      return seg;
    });
    const values: number[] = [];
    for (const s of stacks) for (const k of ECO_KEYS) values.push(...s[k]);
    for (const d of data) values.push(d.balance);
    const f = categoryFrame(W, this.height(), { top: 10, right: 8, left: 8, bottom: 0 }, 60, 30, data.map(d => d.name), values,
      { yFmt: v => `${Math.round(v / 1000)}k€`, xFont: { fontSize: 10, fill: '#334155', fontWeight: 600 }, interval0: true, legendH: this.legendH(), yAll: true }); // Recharts affiche ici les 5 graduations
    const pos = barPositions(f.band, 1, '10%')[0];
    const bars = ECO_KEYS.map(k => ({
      key: k, fill: ECO_FILL[k],
      paths: data.map((_, i) => {
        const [lo, hi] = stacks[i][k];
        const v = data[i][k];
        const x = f.plot.x + f.band * i + pos.offset;
        const y = f.ys(v >= 0 ? hi : lo), h = v >= 0 ? f.ys(lo) - f.ys(hi) : f.ys(hi) - f.ys(lo);
        if (!h || !pos.size) return null;
        return v >= 0 ? rectPath(x, y, pos.size, h, k === 'gain' ? [4, 4, 0, 0] : 0) : rectPath(x, f.ys(hi), pos.size, f.ys(lo) - f.ys(hi), 0);
      }),
    }));
    const points = data.map((d, i) => [f.center(i), f.ys(d.balance)] as [number, number]);
    return { ...f, bars, points, zero: f.ys(0), balance: pathOf(points, curveLinear) };
  });
  protected activeIndex = computed(() => { const g = this.g(); return g ? bandIndex(this.mouse(), g.plot, g.band, this.data().length) : -1; });
  protected tipCoord = computed(() => { const g = this.g(), i = this.activeIndex(), m = this.mouse(); return g && i >= 0 && m ? { x: g.center(i), y: m.y } : null; });
  protected tip = computed(() => {
    const i = this.activeIndex(); if (i < 0) return null;
    const d = this.data()[i];
    const items: TipItem[] = [...ECO_KEYS, 'balance' as const].map(k => ({ name: ECO_TIP[k], value: fmtEur(Math.abs(Number(d[k]))), color: ECO_FILL[k] }));
    return { label: d.name, items };
  });
}
