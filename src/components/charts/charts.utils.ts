import { line as d3line, type CurveFactory } from 'd3-shape';
import { dayLabel, PHENOLOGY, type SimOutput, type StrategyResult } from '@/lib/engine';
import type { Strategy } from '@/lib/store';
import { allTicks, autoDomain, cartesianLabel, inBox, linear, nearestIndex, preserveEnd, type AxisSpec, type Box, type TextSpec } from '../chartkit';

export const THRESHOLD = 20000;

export const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

// Index O(1) — évitent un find() par série, par barre et à chaque survol de souris
export const FALLBACK = '#64748B';
export function colorMap(strategies: Strategy[]) {
  return new Map(strategies.map(s => [s.id, s.color]));
}
export function nameMap(results: StrategyResult[]) {
  return new Map(results.map(r => [r.id, r.name]));
}

export function phenoBands(out: SimOutput) {
  const bands: { x1: number; x2: number; type: string; label: string }[] = [];
  const years = Math.ceil((out.startDayOfYear + out.totalDays) / 365);
  for (let y = 0; y < years; y++) for (const p of out.phenology) {
    const x1 = y * 365 + p.start - out.startDayOfYear, x2 = y * 365 + p.end - out.startDayOfYear;
    if (x2 < 0 || x1 > out.totalDays) continue;
    bands.push({ x1: Math.max(0, x1), x2: Math.min(out.totalDays, x2), type: p.type, label: PHENOLOGY[p.type as keyof typeof PHENOLOGY].label });
  }
  return bands;
}

function monthTicks(out: SimOutput) {
  const ticks: number[] = [];
  for (let d = 0; d <= out.totalDays; d++) if (dayLabel(d, out.startDayOfYear).label.startsWith('1 ')) ticks.push(d);
  return ticks;
}

export const kFmt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);
export const pathOf = (pts: [number, number | null][], curve: CurveFactory) =>
  d3line<[number, number | null]>().x(p => p[0]).y(p => p[1] as number).defined(p => p[1] !== null && Number.isFinite(p[1])).curve(curve)(pts) ?? '';
export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Cadre d'un graphique cartésien à axe X numérique (jours). */
export function dayFrame(W: number, H: number, m: { top: number; right: number; bottom: number; left: number }, yW: number, out: SimOutput, values: number[],
  opts: { fixed?: [number, number]; unit?: string; yFmt?: (v: number) => string; xFmt: (d: number) => string; yLabel?: string }) {
  const xH = 30;
  const plot: Box = { x: m.left + yW, y: m.top, width: W - m.left - yW - m.right, height: H - m.top - m.bottom - xH };
  const { domain, ticks } = autoDomain(values, opts.fixed);
  const ys = linear(domain, [plot.y + plot.height, plot.y]);
  const xs = linear([0, out.totalDays], [plot.x, plot.x + plot.width]);
  const yBox: Box = { x: m.left, y: plot.y, width: yW, height: plot.height };
  const xBox: Box = { x: plot.x, y: plot.y + plot.height, width: plot.width, height: xH };
  const yFmt = opts.yFmt ?? ((v: number) => `${v}${opts.unit ?? ''}`);
  const yAxis: AxisSpec = {
    box: yBox, orient: 'left', fontSize: 10, fill: '#64748B',
    ticks: preserveEnd(ticks.map(v => ({ coord: ys(v), label: yFmt(v) })), yBox, 'left', 10),
    label: opts.yLabel ? cartesianLabel(opts.yLabel, 'insideLeft', yBox, { fontSize: 10, fill: '#64748B', angle: -90 }) : null,
  };
  const xAxis: AxisSpec = {
    box: xBox, orient: 'bottom', fontSize: 10, fill: '#64748B',
    ticks: preserveEnd(monthTicks(out).map(d => ({ coord: xs(d), label: opts.xFmt(d) })), xBox, 'bottom', 10),
  };
  return { W, H, plot, xAxis, yAxis, ys, xs, domain, gridYs: ticks.map(ys) };
}

// ============================================================ Récolte par parcelle
function wrapTickLines(value: string) {
  const words = value.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > 14 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 2).map((l, i) => (i === 1 && lines.length > 2 ? l.slice(0, 12) + '…' : l));
}

export interface BarSpec { d: string | null; fill: string; label: TextSpec }

/** Cadre d'un graphique à barres (axe X par catégories). */
export function categoryFrame(W: number, H: number, m: { top: number; right: number; bottom: number; left: number }, yW: number, xH: number, cats: string[], values: number[],
  opts: { fixed?: [number, number]; unit?: string; yFmt?: (v: number) => string; xFont: { fontSize: number; fill: string; fontWeight?: number }; wrap?: boolean; interval0?: boolean; legendH?: number; yAll?: boolean }) {
  const plot: Box = { x: m.left + yW, y: m.top, width: W - m.left - yW - m.right, height: H - m.top - m.bottom - xH - (opts.legendH ?? 0) };
  const { domain, ticks } = autoDomain(values, opts.fixed);
  const ys = linear(domain, [plot.y + plot.height, plot.y]);
  const band = cats.length ? plot.width / cats.length : plot.width;
  const center = (i: number) => plot.x + band * i + band / 2;
  const yBox: Box = { x: m.left, y: plot.y, width: yW, height: plot.height };
  const xBox: Box = { x: plot.x, y: plot.y + plot.height, width: plot.width, height: xH };
  const yFmt = opts.yFmt ?? ((v: number) => `${v}${opts.unit ?? ''}`);
  const raw = cats.map((c, i) => ({ coord: center(i), label: c }));
  const xTicks = opts.interval0 ? allTicks(raw) : preserveEnd(raw, xBox, 'bottom', opts.xFont.fontSize);
  if (opts.wrap) for (const t of xTicks) t.lines = wrapTickLines(t.label);
  return {
    W, H, plot, ys, domain, band, center, gridYs: ticks.map(ys),
    yAxis: { box: yBox, orient: 'left', fontSize: 10, fill: '#64748B', ticks: opts.yAll ? allTicks(ticks.map(v => ({ coord: ys(v), label: yFmt(v) }))) : preserveEnd(ticks.map(v => ({ coord: ys(v), label: yFmt(v) })), yBox, 'left', 10) } as AxisSpec,
    xAxis: { box: xBox, orient: 'bottom', ...opts.xFont, wrap: opts.wrap, ticks: xTicks } as AxisSpec,
  };
}

export function bandIndex(m: { x: number; y: number } | null, plot: Box, band: number, n: number) {
  if (!m || !inBox(m, plot) || !n) return -1;
  return Math.min(n - 1, Math.max(0, Math.floor((m.x - plot.x) / band)));
}

/** Survol d'un graphique en courbes par jour : point le plus proche, points actifs et contenu de l'info-bulle. */
export function lineActive(g: { plot: Box; ys: (v: number) => number; xsData: number[]; lines: { id: string; color: string }[] } | null, m: { x: number; y: number } | null,
  rows: Record<string, number>[], out: SimOutput, value: (v: number) => string, names: Map<string, string>) {
  if (!g || !m || !inBox(m, g.plot)) return null;
  const i = nearestIndex(g.xsData, m.x);
  if (i < 0) return null;
  const row = rows[i], x = g.xsData[i];
  const present = g.lines.filter(s => num(row[s.id]) !== null);
  const l = dayLabel(Number(row['day']), out.startDayOfYear);
  return {
    x, coord: { x, y: m.y }, label: `${l.label} — Année ${l.year}`,
    dots: present.map(s => ({ x, y: g.ys(row[s.id]), color: s.color })),
    items: present.map(s => ({ name: names.get(s.id) ?? s.id, value: value(row[s.id]), color: s.color })),
  };
}
