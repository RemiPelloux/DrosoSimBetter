import { Component, computed, input, signal } from '@angular/core';
import { area as d3area, curveMonotoneX } from 'd3-shape';
import { dayLabel, isCherry, type SimOutput, type StrategyResult, type EventType, type SimEvent, type SeriesPoint } from '@/lib/engine';
import type { Parcel } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ChartBase, ChartTooltip, SvgAxis, SvgGrid, SvgText, cartesianLabel, inBox, nearestIndex, rectPath, type Box, type TextSpec } from '../chartkit';
import { LegendChip } from './legend-chip.component';
import { phenoBands, num, dayFrame, kFmt, THRESHOLD, pathOf, fmt } from './charts.utils';

 // seuil de risque économique indicatif (femelles/ha) à l'échelle du modèle

const EVENT_META: Record<EventType, { icon: string; label: string; color: string }> = {
  treatment: { icon: '🚜', label: 'Traitement', color: '#D97706' },
  net: { icon: '🛡️', label: 'Pose filet', color: '#2563EB' },
  harvest: { icon: '🧺', label: 'Récolte', color: '#0F172A' },
  parasitoid: { icon: '🐝', label: 'Lâcher parasitoïdes', color: '#7C3AED' },
  tis: { icon: '🧬', label: 'Début lâchers TIS', color: '#DB2777' },
};

@Component({
  selector: 'ds-population-chart',
  imports: [SvgAxis, SvgGrid, SvgText, ChartTooltip, LegendChip],
  host: { style: 'display: contents' },
  templateUrl: './population-chart.component.html',
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
