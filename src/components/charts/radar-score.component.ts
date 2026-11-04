import { Component, computed, input } from '@angular/core';
import { type SimOutput, type StrategyResult } from '@/lib/engine';
import type { Strategy } from '@/lib/store';
import { ChartBase, ChartTooltip, DefaultTooltip, SvgText, type Box, type TextSpec } from '../chartkit';
import { colorMap, FALLBACK } from './charts.utils';

// ============================================================ Radar multicritère
/** Scores 0-100 de toutes les stratégies : les maxima sont calculés une seule fois (O(n) au lieu de O(n²)). */
export function scoreStrategies(all: StrategyResult[], base: StrategyResult | undefined) {
  const net = (x: StrategyResult) => x.revenue - (base?.revenue ?? 0) - x.totalCost;
  const ctx = {
    maxCost: Math.max(1, ...all.map(x => x.totalCost)),
    maxLabor: Math.max(1, ...all.map(x => x.laborHours)),
    maxPeak: Math.max(1, ...all.map(x => x.peakDensity)),
    maxGain: Math.max(1, ...all.map(x => Math.abs(net(x)))),
  };
  return all.map(r => ({ id: r.id, s: scoreOne(r, net(r), ctx) }));
}

function scoreOne(r: StrategyResult, gain: number, { maxCost, maxLabor, maxPeak, maxGain }: { maxCost: number; maxLabor: number; maxPeak: number; maxGain: number }) {
  return {
    'Récolte': Math.round(r.globalHarvest),
    'Rentabilité': Math.round(50 + (gain / maxGain) * 50),
    'Environnement': Math.round(Math.max(0, 100 - r.ift * 20)),
    'Main-d’œuvre': Math.round(100 - (r.laborHours / maxLabor) * 100),
    'Pression maîtrisée': Math.round(100 - (r.peakDensity / maxPeak) * 100),
    'Investissement': Math.round(100 - (r.totalCost / maxCost) * 100),
  };
}

const RAD = Math.PI / 180;
const polar = (cx: number, cy: number, r: number, angle: number) => ({ x: cx + Math.cos(-angle * RAD) * r, y: cy + Math.sin(-angle * RAD) * r });

@Component({
  selector: 'ds-radar-score',
  imports: [SvgText, ChartTooltip, DefaultTooltip],
  host: { style: 'display: contents' },
  templateUrl: './radar-score.component.html',
})
export class RadarScore extends ChartBase {
  readonly out = input.required<SimOutput>();
  readonly strategies = input.required<Strategy[]>();
  readonly height = input(300);

  private scores = computed(() => { const out = this.out(); return scoreStrategies(out.results, out.results.find(r => r.isBaseline)); });
  private axes = computed(() => Object.keys(this.scores()[0]?.s ?? {}));

  protected g = computed(() => {
    const W = this.width(); if (!W) return null;
    const H = this.height(), m = 5;
    const w = W - 2 * m, h = H - 2 * m;
    const cx = m + w / 2, cy = m + h / 2;
    const outer = Math.min(w, h) / 2 * 0.72;
    const axes = this.axes(), n = axes.length;
    const angles = axes.map((_, i) => 90 - (i * 360) / Math.max(1, n));
    const colors = colorMap(this.strategies());
    const ring = (r: number) => angles.map((a, i) => { const p = polar(cx, cy, r, a); return `${i ? 'L' : 'M'}${p.x},${p.y}`; }).join('') + 'Z';
    const ticks: TextSpec[] = axes.map((label, i) => {
      const a = angles[i];
      const p = polar(cx, cy, outer + 8, a);
      const cos = Math.cos(-a * RAD), sin = Math.sin(-a * RAD);
      const anchor = cos > 1e-5 ? 'start' : cos < -1e-5 ? 'end' : 'middle';
      const vertical = Math.abs(cos) <= Math.SQRT1_2 ? (sin > 0 ? 'start' : 'end') : 'middle';
      return { x: p.x, y: p.y, lines: [label], anchor, dy0: vertical === 'start' ? '0.71em' : vertical === 'middle' ? '0.355em' : '0em', fill: '#334155', fontSize: 10, fontWeight: 600, cls: 'recharts-text recharts-polar-angle-axis-tick-value' };
    });
    const results = this.out().results, scores = this.scores();
    const polys = results.map(r => {
      const sc = scores.find(x => x.id === r.id)?.s as Record<string, number> | undefined;
      const pts = axes.map((ax, i) => polar(cx, cy, ((sc?.[ax] ?? 0) / 100) * outer, angles[i]));
      return { id: r.id, color: colors.get(r.id) ?? FALLBACK, opacity: r.isBaseline ? 0.05 : 0.15, pts, d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('') + 'Z', name: r.isBaseline ? 'Témoin' : r.name, sc };
    });
    return {
      W, H, cx, cy, outer, angles, ticks, polys, box: { x: m, y: m, width: w, height: h } as Box,
      spokes: angles.map(a => polar(cx, cy, outer, a)), rings: [0, 25, 50, 75, 100].map(t => ring((t / 100) * outer)),
    };
  });

  protected active = computed(() => {
    const g = this.g(), m = this.mouse();
    if (!g || !m || !g.angles.length) return null;
    const dx = m.x - g.cx, dy = m.y - g.cy;
    if (Math.hypot(dx, dy) > g.outer) return null;
    let ang = Math.atan2(-dy, dx) / RAD;
    let best = 0, bd = Infinity;
    g.angles.forEach((a, i) => { const d = Math.abs((((ang - a) % 360) + 540) % 360 - 180); if (d < bd) { bd = d; best = i; } });
    ang = g.angles[best];
    const edge = polar(g.cx, g.cy, g.outer, ang);
    const axis = this.axes()[best];
    return {
      edge, coord: { x: edge.x, y: edge.y }, label: axis,
      dots: g.polys.map(p => ({ ...p.pts[best], color: p.color })),
      items: g.polys.map(p => ({ name: p.name, value: String(p.sc?.[axis] ?? ''), color: p.color })),
    };
  });
}
