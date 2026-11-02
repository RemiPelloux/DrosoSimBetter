import { Component, ElementRef, afterRenderEffect, computed, input, output, signal, untracked, viewChild } from '@angular/core';
import { line as d3line, area as d3area, curveMonotoneX, curveStepAfter, curveLinear, type CurveFactory } from 'd3-shape';
import { dayLabel, isCherry, PHENOLOGY, TYPE_LABEL, type SimOutput, type StrategyResult, type EventType, type SimEvent, type SeriesPoint } from '@/lib/engine';
import type { Parcel, Strategy } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  ChartBase, ChartTooltip, DefaultTooltip, SvgAxis, SvgGrid, SvgText, allTicks, autoDomain, barPositions, cartesianLabel, inBox, linear, nearestIndex,
  preserveEnd, rectPath, type AxisSpec, type Box, type TextSpec, type TipItem,
} from './chartkit';

export const THRESHOLD = 20000; // seuil de risque économique indicatif (femelles/ha) à l'échelle du modèle

const EVENT_META: Record<EventType, { icon: string; label: string; color: string }> = {
  treatment: { icon: '🚜', label: 'Traitement', color: '#D97706' },
  net: { icon: '🛡️', label: 'Pose filet', color: '#2563EB' },
  harvest: { icon: '🧺', label: 'Récolte', color: '#0F172A' },
  parasitoid: { icon: '🐝', label: 'Lâcher parasitoïdes', color: '#7C3AED' },
  tis: { icon: '🧬', label: 'Début lâchers TIS', color: '#DB2777' },
};

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
export const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

// Index O(1) — évitent un find() par série, par barre et à chaque survol de souris
const FALLBACK = '#64748B';
export function colorMap(strategies: Strategy[]) {
  return new Map(strategies.map(s => [s.id, s.color]));
}
function nameMap(results: StrategyResult[]) {
  return new Map(results.map(r => [r.id, r.name]));
}

function phenoBands(out: SimOutput) {
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

const kFmt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);
const pathOf = (pts: [number, number | null][], curve: CurveFactory) =>
  d3line<[number, number | null]>().x(p => p[0]).y(p => p[1] as number).defined(p => p[1] !== null && Number.isFinite(p[1])).curve(curve)(pts) ?? '';
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Cadre d'un graphique cartésien à axe X numérique (jours). */
function dayFrame(W: number, H: number, m: { top: number; right: number; bottom: number; left: number }, yW: number, out: SimOutput, values: number[],
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

// ============================================================ Dynamique
@Component({
  selector: 'ds-legend-chip',
  host: { style: 'display: contents' },
  template: `
    <button (click)="toggle.emit()" [class]="cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all', active() ? 'border-slate-200 bg-white text-slate-700' : 'border-dashed border-slate-300 bg-slate-50 text-slate-400 line-through')">
      <ng-content />{{ label() }}
    </button>
  `,
})
export class LegendChip {
  readonly active = input.required<boolean>();
  readonly label = input.required<string>();
  readonly toggle = output<void>();
  protected cn = cn;
}

@Component({
  selector: 'ds-population-chart',
  imports: [SvgAxis, SvgGrid, SvgText, ChartTooltip, LegendChip],
  host: { style: 'display: contents' },
  template: `
    <div>
      <div [style.height.px]="height()">
        <div #wrap class="recharts-responsive-container" style="width: 100%; height: 100%; min-width: 0">
          @if (g(); as g) {
            <div class="chart-wrapper recharts-wrapper" style="position: relative; cursor: default" [style.width.px]="g.W" [style.height.px]="g.H" (mousemove)="onMove($event)" (mouseleave)="onLeave()">
              <svg class="recharts-surface" [attr.width]="g.W" [attr.height]="g.H" [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" style="width: 100%; height: 100%">
                <defs>
                  <linearGradient id="gForest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15803D" stop-opacity="0.25" /><stop offset="100%" stop-color="#15803D" stop-opacity="0" /></linearGradient>
                </defs>
                <g [dsGrid]="g.plot" [ys]="g.gridYs" />
                @for (b of g.bands; track $index) { <path class="recharts-rectangle recharts-reference-area-rect" [attr.d]="b.d" [attr.fill]="b.fill" fill-opacity="0.35" stroke="none" /> }
                @for (s of g.areas; track s.id) {
                  <g class="recharts-layer recharts-area">
                    <path class="recharts-curve recharts-area-area" [attr.d]="s.area" fill="url(#gForest)" fill-opacity="0.6" stroke="none" />
                    <path class="recharts-curve recharts-area-curve chart-line" [attr.d]="s.d" [attr.stroke]="s.color" stroke-width="2" fill="none" />
                  </g>
                }
                @if (g.threshold; as t) { <line class="recharts-reference-line-line" [attr.x1]="g.plot.x" [attr.x2]="g.plot.x + g.plot.width" [attr.y1]="t.y" [attr.y2]="t.y" stroke="#DC2626" stroke-dasharray="6 4" fill="none" stroke-width="1" /> }
                @for (e of g.events; track $index) { <line class="recharts-reference-line-line" [attr.x1]="e.x" [attr.x2]="e.x" [attr.y1]="g.plot.y" [attr.y2]="g.plot.y + g.plot.height" [attr.stroke]="e.color" stroke-opacity="0.5" stroke-dasharray="2 3" fill="none" stroke-width="1" /> }
                @for (s of g.lines; track s.id) { <path class="recharts-curve recharts-line-curve chart-line" [attr.d]="s.d" [attr.stroke]="s.color" stroke-width="2.5" fill="none" /> }
                <g [dsAxis]="g.xAxis" />
                <g [dsAxis]="g.yAxis" />
                @if (active(); as a) {
                  <path class="recharts-curve recharts-tooltip-cursor" [attr.d]="'M' + a.x + ',' + g.plot.y + 'L' + a.x + ',' + (g.plot.y + g.plot.height)" stroke="#ccc" fill="none" pointer-events="none" />
                  @for (d of a.dots; track $index) { <circle class="recharts-dot" [attr.cx]="d.x" [attr.cy]="d.y" r="4" [attr.fill]="d.color" stroke="#fff" stroke-width="2" /> }
                }
                @for (l of g.labels; track $index) { <g [dsText]="l" /> }
              </svg>
              <ds-chart-tooltip [coord]="active()?.coord ?? null" [viewBox]="g.plot">
                @if (tip(); as t) {
                  <div class="min-w-56 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
                    <p class="mb-2 font-bold text-slate-900">{{ t.title }}</p>
                    @for (r of t.rows; track r.id) {
                      <div class="flex items-center justify-between gap-4 py-0.5">
                        <span class="flex items-center gap-1.5 text-slate-600"><span class="h-2 w-2 rounded-full" [style.background-color]="r.color"></span>{{ r.name }}</span>
                        <span class="font-mono font-semibold text-slate-900">{{ r.value }}<span class="text-slate-400">/ha</span>@if (r.healthy !== null) {<span [class]="cn('ml-2', r.healthy < 80 ? 'text-red-600' : 'text-emerald-600')">{{ r.healthy.toFixed(0) }}% sains</span>}</span>
                      </div>
                    }
                    @if (t.events.length) { <div class="mt-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-600">@for (e of t.events; track $index) {<div>{{ e }}</div>}</div> }
                  </div>
                }
              </ds-chart-tooltip>
            </div>
          }
        </div>
      </div>
      @if (!compact()) {
        <div class="mt-3 flex flex-wrap gap-1.5">
          @for (p of lineParcels(); track p.id) {
            <ds-legend-chip [active]="!hidden()[p.id]" (toggle)="flip(p.id)" [label]="(p.type === 'forest' ? '🌲' : '🍒') + ' ' + p.name + ' ' + (p.type === 'forest' ? '(réservoir sauvage)' : '(femelles adultes)')">
              <span class="h-0.5 w-5 rounded" [style.background-color]="p.color" style="height: 3px"></span>
            </ds-legend-chip>
          }
          <ds-legend-chip [active]="!hidden()['threshold']" (toggle)="flip('threshold')" label="⚠️ Seuil de risque économique"><span class="w-5 border-t-2 border-dashed border-red-600"></span></ds-legend-chip>
          @if (showEvents()) { <ds-legend-chip [active]="!hidden()['events']" (toggle)="flip('events')" label="Interventions (🚜 🛡️ 🧺 🐝 🧬)"><span class="text-xs">📍</span></ds-legend-chip> }
          @if (bands().length > 0) { <span class="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900"><span class="h-3 w-5 rounded-sm bg-amber-200"></span> Période de sensibilité (véraison → récolte)</span> }
        </div>
      }
    </div>
  `,
})
export class PopulationChart extends ChartBase {
  readonly out = input.required<SimOutput>();
  readonly result = input.required<StrategyResult>();
  readonly parcels = input.required<Parcel[]>();
  readonly height = input(340);
  readonly showEvents = input(true);
  readonly compact = input(false);
  protected hidden = signal<Record<string, boolean>>({});
  protected cn = cn;

  protected bands = computed(() => phenoBands(this.out()));
  protected lineParcels = computed(() => this.parcels().filter(p => p.type !== 'neutral'));
  private events = computed(() => {
    // dédoublonnage par jour/type
    const seen = new Set<string>();
    return this.result().events.filter(e => { const k = `${e.day}-${e.type}`; if (seen.has(k)) return false; seen.add(k); return true; });
  });
  // index pour l'infobulle : recherche O(1) au survol au lieu de parcourir les séries et les événements
  private tipIndex = computed(() => {
    const result = this.result();
    const damageByDay = new Map<number, SeriesPoint>(result.damageSeries.map(d => [d.day, d]));
    const eventsByDay = new Map<number, SimEvent[]>();
    for (const e of result.events) for (const d of [e.day - 1, e.day, e.day + 1]) {
      const list = eventsByDay.get(d); if (list) list.push(e); else eventsByDay.set(d, [e]);
    }
    const parcelName = new Map(this.parcels().map(p => [p.id, p.name]));
    return { damageByDay, eventsByDay, parcelName };
  });

  protected flip(k: string) { this.hidden.update(h => ({ ...h, [k]: !h[k] })); }

  protected g = computed(() => {
    const W = this.width(); if (!W) return null;
    const out = this.out(), data = this.result().series, hidden = this.hidden(), compact = this.compact();
    const visible = this.lineParcels().filter(p => !hidden[p.id]);
    const values: number[] = [];
    for (const d of data) for (const p of visible) { const v = num(d[p.id]); if (v !== null) values.push(v); }
    const f = dayFrame(W, this.height(), { top: 22, right: 16, left: 4, bottom: 0 }, 40, out, values, {
      yFmt: kFmt, yLabel: compact ? undefined : 'Femelles / ha',
      xFmt: d => { const l = dayLabel(d, out.startDayOfYear); return l.month + (l.doy < 31 || d === 0 ? ` A${l.year}` : ''); },
    });
    const { plot, xs, ys, domain } = f;
    const bandColor: Record<string, string> = { 'early-cherry': '#FDE68A', 'season-cherry': '#FECDD3', 'late-cherry': '#FCA5A5' };
    const labels: TextSpec[] = [];
    const bands = this.bands().map(b => {
      const x1 = xs(b.x1), x2 = xs(b.x2);
      const box: Box = { x: Math.min(x1, x2), y: plot.y, width: Math.abs(x2 - x1), height: plot.height };
      if (!compact) labels.push(cartesianLabel(`🍒 ${b.label}`, 'insideTop', box, { fontSize: 9, fill: '#7F1D1D' }));
      return { d: rectPath(box.x, box.y, box.width, box.height), fill: bandColor[b.type] };
    });
    let threshold: { y: number } | null = null;
    if (!hidden['threshold'] && THRESHOLD >= domain[0] && THRESHOLD <= domain[1]) {
      threshold = { y: ys(THRESHOLD) };
      labels.push(cartesianLabel('⚠️ Seuil de risque', 'insideTopRight', { x: plot.x, y: threshold.y, width: plot.width, height: 0 }, { fontSize: 10, fill: '#DC2626' }));
    }
    const events = this.showEvents() && !hidden['events'] ? this.events().filter(e => e.day >= 0 && e.day <= out.totalDays).map(e => {
      const x = xs(e.day);
      labels.push(cartesianLabel(EVENT_META[e.type].icon, 'top', { x, y: plot.y, width: 0, height: plot.height }, { fontSize: 12 }));
      return { x, color: EVENT_META[e.type].color };
    }) : [];
    const pts = (id: string) => data.map(d => [xs(d.day), num(d[id]) === null ? null : ys(d[id] as number)] as [number, number | null]);
    const base = ys(domain[0]);
    const areas = visible.filter(p => p.type === 'forest').map(p => {
      const ps = pts(p.id);
      const area = d3area<[number, number | null]>().x(q => q[0]).y0(base).y1(q => q[1] as number).defined(q => q[1] !== null).curve(curveMonotoneX)(ps) ?? '';
      return { id: p.id, color: p.color, d: pathOf(ps, curveMonotoneX), area };
    });
    const lines = visible.filter(p => p.type !== 'forest').map(p => ({ id: p.id, color: p.color, d: pathOf(pts(p.id), curveMonotoneX) }));
    return { ...f, bands, threshold, events, areas, lines, labels, xsData: data.map(d => xs(d.day)), visible };
  });

  protected active = computed(() => {
    const g = this.g(), m = this.mouse();
    if (!g || !m || !inBox(m, g.plot)) return null;
    const i = nearestIndex(g.xsData, m.x);
    if (i < 0) return null;
    const d = this.result().series[i];
    const x = g.xsData[i];
    const dots = g.visible.map(p => ({ v: num(d[p.id]), color: p.color })).filter(o => o.v !== null).map(o => ({ x, y: g.ys(o.v as number), color: o.color }));
    return { index: i, x, dots, coord: { x, y: m.y } };
  });

  protected tip = computed(() => {
    const a = this.active(); const g = this.g();
    if (!a || !g) return null;
    const out = this.out(), d = this.result().series[a.index], label = d.day;
    const idx = this.tipIndex();
    const dl = dayLabel(label, out.startDayOfYear);
    const dmg = idx.damageByDay.get(label);
    const ev = idx.eventsByDay.get(label) ?? [];
    const rows = g.visible.filter(p => num(d[p.id]) !== null).map(p => {
      const h = dmg?.[p.id] as number | undefined;
      return { id: p.id, name: p.name, color: p.color, value: fmt(d[p.id] as number), healthy: h !== undefined && isCherry(p.type) ? h : null };
    });
    return {
      title: `${dl.label} — Année ${dl.year}`, rows,
      events: ev.map(e => `${EVENT_META[e.type].icon} ${EVENT_META[e.type].label} — ${idx.parcelName.get(e.parcelId) ?? ''}`),
    };
  });
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

interface BarSpec { d: string | null; fill: string; label: TextSpec }

/** Cadre d'un graphique à barres (axe X par catégories). */
function categoryFrame(W: number, H: number, m: { top: number; right: number; bottom: number; left: number }, yW: number, xH: number, cats: string[], values: number[],
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

function bandIndex(m: { x: number; y: number } | null, plot: Box, band: number, n: number) {
  if (!m || !inBox(m, plot) || !n) return -1;
  return Math.min(n - 1, Math.max(0, Math.floor((m.x - plot.x) / band)));
}

@Component({
  selector: 'ds-strategy-legend',
  host: { style: 'display: contents' },
  template: `
    <div class="mt-2 flex flex-wrap justify-center gap-3">
      @for (r of results(); track r.id) {
        <span class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
          <span [class]="cn('h-3 w-3 rounded-sm', r.isBaseline && 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_2px,#94A3B8_2px_4px)]')" [style.background-color]="r.isBaseline ? null : colors().get(r.id)"></span>
          {{ r.isBaseline ? 'Témoin sans levier' : r.name }}
        </span>
      }
    </div>
  `,
})
export class StrategyLegend {
  readonly results = input.required<StrategyResult[]>();
  readonly strategies = input.required<Strategy[]>();
  protected colors = computed(() => colorMap(this.strategies()));
  protected cn = cn;
}

@Component({
  selector: 'ds-empty',
  host: { style: 'display: contents' },
  template: `<div class="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs italic text-slate-400"><ng-content /></div>`,
})
export class Empty {}

const BAR_CHART_TEMPLATE_A = `
  <div [style.height.px]="height()">
    <div #wrap class="recharts-responsive-container" style="width: 100%; height: 100%; min-width: 0">
      @if (g(); as g) {
        <div class="chart-wrapper recharts-wrapper" style="position: relative; cursor: default" [style.width.px]="g.W" [style.height.px]="g.H" (mousemove)="onMove($event)" (mouseleave)="onLeave()">
          <svg class="recharts-surface" [attr.width]="g.W" [attr.height]="g.H" [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" style="width: 100%; height: 100%">
            `;
const BAR_CHART_TEMPLATE_B = `
            <g [dsGrid]="g.plot" [ys]="g.gridYs" />
            @if (activeIndex() >= 0) { <path class="recharts-rectangle recharts-tooltip-cursor" [attr.d]="cursorPath()" [attr.fill]="cursorFill" stroke="none" pointer-events="none" /> }
            @for (s of g.series; track s.id) {
              <g class="recharts-layer recharts-bar"><g class="recharts-layer recharts-bar-rectangles">
                @for (b of s.bars; track $index) { @if (b.d) { <path class="recharts-rectangle" [attr.d]="b.d" [attr.fill]="b.fill" /> } }
              </g></g>
            }
            <g [dsAxis]="g.xAxis" />
            <g [dsAxis]="g.yAxis" />
            @for (s of g.series; track s.id) { @for (b of s.bars; track $index) { <g [dsText]="b.label" /> } }
          </svg>
          <ds-chart-tooltip [coord]="tipCoord()" [viewBox]="g.plot">
            @if (tip(); as t) { <ds-default-tooltip [label]="t.label" [items]="t.items" /> }
          </ds-chart-tooltip>
        </div>
      }
    </div>
  </div>
`;

@Component({
  selector: 'ds-harvest-by-parcel-chart',
  imports: [SvgAxis, SvgGrid, SvgText, ChartTooltip, DefaultTooltip, StrategyLegend, Empty],
  host: { style: 'display: contents' },
  template: `
    @if (!cherry().length) { <ds-empty>Aucune parcelle de cerisiers.</ds-empty> }
    @else {
      <div>
` + BAR_CHART_TEMPLATE_A + `<defs>
              <pattern id="hatchBase" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#CBD5E1" /><line x1="0" y1="0" x2="0" y2="6" stroke="#94A3B8" stroke-width="3" />
              </pattern>
            </defs>` + BAR_CHART_TEMPLATE_B + `
        <ds-strategy-legend [results]="out().results" [strategies]="strategies()" />
      </div>
    }
  `,
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

// ============================================================ Superposition des stratégies
const LINE_CHART_TEMPLATE_A = `
  <div [style.height.px]="height()">
    <div #wrap class="recharts-responsive-container" style="width: 100%; height: 100%; min-width: 0">
      @if (g(); as g) {
        <div class="chart-wrapper recharts-wrapper" style="position: relative; cursor: default" [style.width.px]="g.W" [style.height.px]="g.H" (mousemove)="onMove($event)" (mouseleave)="onLeave()">
          <svg class="recharts-surface" [attr.width]="g.W" [attr.height]="g.H" [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" style="width: 100%; height: 100%">
            <g [dsGrid]="g.plot" [ys]="g.gridYs" />
            `;
const LINE_CHART_TEMPLATE_B = `
            @for (s of g.lines; track s.id) { <path class="recharts-curve recharts-line-curve chart-line" [attr.d]="s.d" [attr.stroke]="s.color" [attr.stroke-width]="s.width" [attr.stroke-dasharray]="s.dash" fill="none" /> }
            <g [dsAxis]="g.xAxis" />
            <g [dsAxis]="g.yAxis" />
            @if (active(); as a) {
              <path class="recharts-curve recharts-tooltip-cursor" [attr.d]="'M' + a.x + ',' + g.plot.y + 'L' + a.x + ',' + (g.plot.y + g.plot.height)" stroke="#ccc" fill="none" pointer-events="none" />
              @for (d of a.dots; track $index) { <circle class="recharts-dot" [attr.cx]="d.x" [attr.cy]="d.y" r="4" [attr.fill]="d.color" stroke="#fff" stroke-width="2" /> }
            }
          </svg>
          <ds-chart-tooltip [coord]="active()?.coord ?? null" [viewBox]="g.plot">
            @if (active(); as a) { <ds-default-tooltip [label]="a.label" [items]="a.items" /> }
          </ds-chart-tooltip>
        </div>
      }
    </div>
  </div>
`;

/** Survol d'un graphique en courbes par jour : point le plus proche, points actifs et contenu de l'info-bulle. */
function lineActive(g: { plot: Box; ys: (v: number) => number; xsData: number[]; lines: { id: string; color: string }[] } | null, m: { x: number; y: number } | null,
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

@Component({
  selector: 'ds-overlay-chart',
  imports: [SvgAxis, SvgGrid, ChartTooltip, DefaultTooltip],
  host: { style: 'display: contents' },
  template: LINE_CHART_TEMPLATE_A + `
    @for (b of g.bands; track $index) { <path class="recharts-rectangle recharts-reference-area-rect" [attr.d]="b" fill="#FEE2E2" fill-opacity="0.5" stroke="none" /> }
    @if (g.threshold !== null) { <line class="recharts-reference-line-line" [attr.x1]="g.plot.x" [attr.x2]="g.plot.x + g.plot.width" [attr.y1]="g.threshold" [attr.y2]="g.threshold" stroke="#DC2626" stroke-dasharray="6 4" fill="none" stroke-width="1" /> }
  ` + LINE_CHART_TEMPLATE_B,
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

// ============================================================ Économie
const ECO_KEYS = ['gain', 'net', 'phyto', 'labor', 'bio', 'tis'] as const;
const ECO_FILL: Record<string, string> = { gain: '#16A34A', net: '#2563EB', phyto: '#D97706', labor: '#0D9488', bio: '#7C3AED', tis: '#DB2777', balance: '#0F172A' };
const ECO_TIP: Record<string, string> = { gain: 'CA sauvé vs témoin', net: 'Filets', phyto: 'Produits phyto / bio', labor: 'Main-d’œuvre', bio: 'Parasitoïdes', tis: 'TIS', balance: 'Bilan net' };
const ECO_LEGEND: Record<string, string> = { gain: 'CA sauvé', net: 'Filets', phyto: 'Phyto/bio', labor: 'Main-d’œuvre', bio: 'Parasitoïdes', tis: 'TIS', balance: 'Bilan net' };

@Component({
  selector: 'ds-economics-chart',
  imports: [SvgAxis, SvgGrid, ChartTooltip, DefaultTooltip],
  host: { style: 'display: contents' },
  template: `
    <div [style.height.px]="height()">
      <div #wrap class="recharts-responsive-container" style="width: 100%; height: 100%; min-width: 0">
        @if (g(); as g) {
          <div class="chart-wrapper recharts-wrapper" style="position: relative; cursor: default" [style.width.px]="g.W" [style.height.px]="g.H" (mousemove)="onMove($event)" (mouseleave)="onLeave()">
            <svg class="recharts-surface" [attr.width]="g.W" [attr.height]="g.H" [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" style="width: 100%; height: 100%">
              <g [dsGrid]="g.plot" [ys]="g.gridYs" />
              @for (s of g.bars; track s.key) {
                <g class="recharts-layer recharts-bar"><g class="recharts-layer recharts-bar-rectangles">
                  @for (d of s.paths; track $index) { @if (d) { <path class="recharts-rectangle" [attr.d]="d" [attr.fill]="s.fill" /> } }
                </g></g>
              }
              <line class="recharts-reference-line-line" [attr.x1]="g.plot.x" [attr.x2]="g.plot.x + g.plot.width" [attr.y1]="g.zero" [attr.y2]="g.zero" stroke="#0F172A" fill="none" stroke-width="1" />
              <g class="recharts-layer recharts-line">
                <path class="recharts-curve recharts-line-curve chart-line" [attr.d]="g.balance" stroke="#0F172A" stroke-width="2" fill="none" />
                <g class="recharts-layer recharts-line-dots">
                  @for (p of g.points; track $index) { <circle class="recharts-dot recharts-line-dot" [attr.cx]="p[0]" [attr.cy]="p[1]" r="5" fill="#0F172A" stroke="#0F172A" stroke-width="2" /> }
                </g>
              </g>
              <g [dsAxis]="g.xAxis" />
              <g [dsAxis]="g.yAxis" />
              @if (activeIndex() >= 0) {
                <path class="recharts-curve recharts-tooltip-cursor" [attr.d]="'M' + g.center(activeIndex()) + ',' + g.plot.y + 'L' + g.center(activeIndex()) + ',' + (g.plot.y + g.plot.height)" stroke="#ccc" fill="none" pointer-events="none" />
                <circle class="recharts-dot" [attr.cx]="g.points[activeIndex()][0]" [attr.cy]="g.points[activeIndex()][1]" r="4" fill="#0F172A" stroke="#fff" stroke-width="2" />
              }
            </svg>
            <div #legend class="recharts-legend-wrapper" style="position: absolute; height: auto; left: 8px; bottom: 0px; font-size: 11px" [style.width.px]="g.W - 16">
              <ul class="recharts-default-legend" style="padding: 0px; margin: 0px; text-align: center">
                @for (k of legendKeys; track k; let i = $index) {
                  <li [class]="'recharts-legend-item legend-item-' + i" style="display: inline-block; margin-right: 10px; white-space: nowrap">
                    <svg class="recharts-surface" width="14" height="14" viewBox="0 0 32 32" style="display: inline-block; vertical-align: middle; margin-right: 4px">
                      @if (k === 'balance') {
                        <path stroke-width="4" fill="none" stroke="#0F172A" d="M0,16h10.666666666666666
            A5.333333333333333,5.333333333333333,0,1,1,21.333333333333332,16
            H32M21.333333333333332,16
            A5.333333333333333,5.333333333333333,0,1,1,10.666666666666666,16" class="recharts-legend-icon" />
                      } @else { <path stroke="none" [attr.fill]="fill[k]" d="M0,4h32v24h-32z" class="recharts-legend-icon" /> }
                    </svg>
                    <span class="recharts-legend-item-text" style="white-space: normal; overflow-wrap: break-word" [style.color]="fill[k]">{{ legendLabels[k] }}</span>
                  </li>
                }
              </ul>
            </div>
            <ds-chart-tooltip [coord]="tipCoord()" [viewBox]="g.plot">
              @if (tip(); as t) { <ds-default-tooltip [label]="t.label" [items]="t.items" /> }
            </ds-chart-tooltip>
          </div>
        }
      </div>
      <span class="sr-only">{{ strategies().length }}</span>
    </div>
  `,
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
  template: `
    <div [style.height.px]="height()">
      <div #wrap class="recharts-responsive-container" style="width: 100%; height: 100%; min-width: 0">
        @if (g(); as g) {
          <div class="chart-wrapper recharts-wrapper" style="position: relative; cursor: default" [style.width.px]="g.W" [style.height.px]="g.H" (mousemove)="onMove($event)" (mouseleave)="onLeave()">
            <svg class="recharts-surface" [attr.width]="g.W" [attr.height]="g.H" [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" style="width: 100%; height: 100%">
              <g class="recharts-polar-grid">
                <g class="recharts-polar-grid-angle">
                  @for (p of g.spokes; track $index) { <line stroke="#E2E8F0" fill="none" [attr.x1]="g.cx" [attr.y1]="g.cy" [attr.x2]="p.x" [attr.y2]="p.y" /> }
                </g>
                <g class="recharts-polar-grid-concentric">
                  @for (d of g.rings; track $index) { <path class="recharts-polar-grid-concentric-polygon" stroke="#E2E8F0" fill="none" [attr.d]="d" /> }
                </g>
              </g>
              @for (s of g.polys; track s.id) {
                <g class="recharts-layer recharts-radar"><path class="recharts-polygon chart-line" [attr.d]="s.d" [attr.stroke]="s.color" [attr.fill]="s.color" [attr.fill-opacity]="s.opacity" stroke-width="2" /></g>
              }
              <g class="recharts-layer recharts-polar-angle-axis angleAxis">
                @for (t of g.ticks; track $index) { <g [dsText]="t" /> }
              </g>
              @if (active(); as a) {
                <path class="recharts-curve recharts-tooltip-cursor" [attr.d]="'M' + g.cx + ',' + g.cy + 'L' + a.edge.x + ',' + a.edge.y" stroke="#ccc" fill="none" pointer-events="none" />
                @for (d of a.dots; track $index) { <circle class="recharts-dot" [attr.cx]="d.x" [attr.cy]="d.y" r="4" [attr.fill]="d.color" stroke="#fff" stroke-width="2" /> }
              }
            </svg>
            <ds-chart-tooltip [coord]="active()?.coord ?? null" [viewBox]="g.box">
              @if (active(); as a) { <ds-default-tooltip [label]="a.label" [items]="a.items" /> }
            </ds-chart-tooltip>
          </div>
        }
      </div>
    </div>
  `,
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

// ============================================================ Évolution des fruits sains
@Component({
  selector: 'ds-healthy-fruit-chart',
  imports: [SvgAxis, SvgGrid, ChartTooltip, DefaultTooltip],
  host: { style: 'display: contents' },
  template: LINE_CHART_TEMPLATE_A + LINE_CHART_TEMPLATE_B,
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

// ============================================================ Récolte par année
@Component({
  selector: 'ds-yearly-harvest-chart',
  imports: [SvgAxis, SvgGrid, SvgText, ChartTooltip, DefaultTooltip, Empty],
  host: { style: 'display: contents' },
  template: '@if (!years()) { <ds-empty>Aucune récolte simulée.</ds-empty> } @else { ' + BAR_CHART_TEMPLATE_A + BAR_CHART_TEMPLATE_B + ' }',
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

export { TYPE_LABEL };
