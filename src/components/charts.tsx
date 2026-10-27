'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Area, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, LabelList, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import { dayLabel, isCherry, PHENOLOGY, TYPE_LABEL, type SimOutput, type StrategyResult, type EventType, type SimEvent, type SeriesPoint } from '@/lib/engine';
import type { Parcel, Strategy } from '@/lib/store';
import { cn } from '@/lib/utils';

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
export function useColorMap(strategies: Strategy[]) {
  return useMemo(() => new Map(strategies.map(s => [s.id, s.color])), [strategies]);
}
function useNameMap(results: StrategyResult[]) {
  return useMemo(() => new Map(results.map(r => [r.id, r.name])), [results]);
}

function phenoBands(out: SimOutput) {
  const bands: { x1: number; x2: number; type: string; label: string }[] = [];
  const years = Math.ceil((out.startDayOfYear + out.totalDays) / 365);
  for (let y = 0; y < years; y++) for (const p of out.phenology) {
    const x1 = y * 365 + p.start - out.startDayOfYear, x2 = y * 365 + p.end - out.startDayOfYear;
    if (x2 < 0 || x1 > out.totalDays) continue;
    bands.push({ x1: Math.max(0, x1), x2: Math.min(out.totalDays, x2), type: p.type, label: PHENOLOGY[p.type].label });
  }
  return bands;
}

function monthTicks(out: SimOutput) {
  const ticks: number[] = [];
  for (let d = 0; d <= out.totalDays; d++) if (dayLabel(d, out.startDayOfYear).label.startsWith('1 ')) ticks.push(d);
  return ticks;
}

// ============================================================ Dynamique
export function PopulationChart({ out, result, parcels, height = 340, showEvents = true, compact = false }: {
  out: SimOutput; result: StrategyResult; parcels: Parcel[]; height?: number; showEvents?: boolean; compact?: boolean;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const bands = useMemo(() => phenoBands(out), [out]);
  const ticks = useMemo(() => monthTicks(out), [out]);
  const lines = parcels.filter(p => p.type !== 'neutral');
  const events = useMemo(() => {
    // dédoublonnage par jour/type
    const seen = new Set<string>();
    return result.events.filter(e => { const k = `${e.day}-${e.type}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [result.events]);
  const bandColor: Record<string, string> = { 'early-cherry': '#FDE68A', 'season-cherry': '#FECDD3', 'late-cherry': '#FCA5A5' };
  // index pour l'infobulle : recherche O(1) au survol au lieu de parcourir les séries et les événements
  const tipIndex = useMemo(() => {
    const damageByDay = new Map(result.damageSeries.map(d => [d.day, d]));
    const eventsByDay = new Map<number, SimEvent[]>();
    for (const e of result.events) for (const d of [e.day - 1, e.day, e.day + 1]) {
      const list = eventsByDay.get(d); if (list) list.push(e); else eventsByDay.set(d, [e]);
    }
    const parcelName = new Map(parcels.map(p => [p.id, p.name]));
    return { damageByDay, eventsByDay, parcelName };
  }, [result, parcels]);

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={result.series} margin={{ top: 22, right: 16, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gForest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#15803D" stopOpacity={0.25} /><stop offset="100%" stopColor="#15803D" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            {bands.map((b, i) => (
              <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill={bandColor[b.type]} fillOpacity={0.35} stroke="none"
                label={compact ? undefined : { value: `🍒 ${b.label}`, position: 'insideTop', fontSize: 9, fill: '#7F1D1D' }} />
            ))}
            <XAxis dataKey="day" type="number" domain={[0, out.totalDays]} ticks={ticks} tick={{ fontSize: 10, fill: '#64748B' }}
              tickFormatter={d => { const l = dayLabel(d, out.startDayOfYear); return l.month + (l.doy < 31 || d === 0 ? ` A${l.year}` : ''); }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40}
              label={compact ? undefined : { value: 'Femelles / ha', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748B' }} />
            <Tooltip content={<PopTooltip parcels={lines} index={tipIndex} out={out} />} />
            {!hidden.threshold && <ReferenceLine y={THRESHOLD} stroke="#DC2626" strokeDasharray="6 4" label={{ value: '⚠️ Seuil de risque', position: 'insideTopRight', fontSize: 10, fill: '#DC2626' }} />}
            {showEvents && !hidden.events && events.map((e, i) => (
              <ReferenceLine key={i} x={e.day} stroke={EVENT_META[e.type].color} strokeOpacity={0.5} strokeDasharray="2 3"
                label={{ value: EVENT_META[e.type].icon, position: 'top', fontSize: 12 }} />
            ))}
            {lines.map(p => p.type === 'forest'
              ? <Area key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} fill="url(#gForest)" strokeWidth={2} hide={hidden[p.id]} isAnimationActive={false} dot={false} />
              : <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} strokeWidth={2.5} hide={hidden[p.id]} isAnimationActive={false} dot={false} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lines.map(p => (
            <LegendChip key={p.id} active={!hidden[p.id]} onClick={() => setHidden(h => ({ ...h, [p.id]: !h[p.id] }))}
              swatch={<span className="h-0.5 w-5 rounded" style={{ backgroundColor: p.color, height: 3 }} />}
              label={`${p.type === 'forest' ? '🌲' : '🍒'} ${p.name} ${p.type === 'forest' ? '(réservoir sauvage)' : '(femelles adultes)'}`} />
          ))}
          <LegendChip active={!hidden.threshold} onClick={() => setHidden(h => ({ ...h, threshold: !h.threshold }))}
            swatch={<span className="w-5 border-t-2 border-dashed border-red-600" />} label="⚠️ Seuil de risque économique" />
          {showEvents && <LegendChip active={!hidden.events} onClick={() => setHidden(h => ({ ...h, events: !h.events }))}
            swatch={<span className="text-xs">📍</span>} label="Interventions (🚜 🛡️ 🧺 🐝 🧬)" />}
          {bands.length > 0 && <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900"><span className="h-3 w-5 rounded-sm bg-amber-200" /> Période de sensibilité (véraison → récolte)</span>}
        </div>
      )}
    </div>
  );
}

type TipIndex = { damageByDay: Map<number, SeriesPoint>; eventsByDay: Map<number, SimEvent[]>; parcelName: Map<string, string> };
function PopTooltip({ active, payload, label, parcels, index, out }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: number; parcels: Parcel[]; index: TipIndex; out: SimOutput }) {
  if (!active || !payload?.length || label === undefined) return null;
  const dl = dayLabel(label, out.startDayOfYear);
  const dmg = index.damageByDay.get(label);
  const ev = index.eventsByDay.get(label) ?? [];
  const valueByKey = new Map(payload.map(x => [x.dataKey, x]));
  return (
    <div className="min-w-56 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
      <p className="mb-2 font-bold text-slate-900">{dl.label} — Année {dl.year}</p>
      {parcels.map(p => {
        const v = valueByKey.get(p.id);
        if (!v) return null;
        const h = dmg?.[p.id] as number | undefined;
        return (
          <div key={p.id} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />{p.name}</span>
            <span className="font-mono font-semibold text-slate-900">{fmt(v.value)}<span className="text-slate-400">/ha</span>{h !== undefined && isCherry(p.type) && <span className={cn('ml-2', h < 80 ? 'text-red-600' : 'text-emerald-600')}>{h.toFixed(0)}% sains</span>}</span>
          </div>
        );
      })}
      {ev.length > 0 && <div className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-600">{ev.map((e, i) => <div key={i}>{EVENT_META[e.type].icon} {EVENT_META[e.type].label} — {index.parcelName.get(e.parcelId)}</div>)}</div>}
    </div>
  );
}

function LegendChip({ active, onClick, swatch, label }: { active: boolean; onClick: () => void; swatch: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all', active ? 'border-slate-200 bg-white text-slate-700' : 'border-dashed border-slate-300 bg-slate-50 text-slate-400 line-through')}>
      {swatch}{label}
    </button>
  );
}

// ============================================================ Récolte par parcelle
export function HarvestByParcelChart({ out, parcels, strategies, height = 300 }: { out: SimOutput; parcels: Parcel[]; strategies: Strategy[]; height?: number }) {
  const cherry = parcels.filter(p => isCherry(p.type));
  const results = out.results;
  const data = cherry.map(p => {
    const row: Record<string, string | number> = { name: `🍒 ${p.name}` };
    results.forEach(r => (row[r.id] = r.harvestByParcel[p.id] ?? 0));
    return row;
  });
  const colors = useColorMap(strategies);
  const names = useNameMap(results);
  const color = (id: string) => colors.get(id) ?? FALLBACK;
  if (!cherry.length) return <Empty>Aucune parcelle de cerisiers.</Empty>;
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: -8, bottom: 4 }} barCategoryGap="22%">
            <defs>
              <pattern id="hatchBase" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#CBD5E1" /><line x1="0" y1="0" x2="0" y2="6" stroke="#94A3B8" strokeWidth="3" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" interval={0} height={cherry.length > 2 ? 44 : 30} tick={<WrapTick />} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748B' }} width={44} />
            <Tooltip formatter={(v, n) => [`${Number(v).toFixed(1)} %`, names.get(String(n)) ?? String(n)]} contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: '#F1F5F9' }} />
            {results.map(r => (
              <Bar key={r.id} dataKey={r.id} name={r.id} fill={r.isBaseline ? 'url(#hatchBase)' : color(r.id)} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey={r.id} position="top" formatter={(v: unknown) => `${Math.round(Number(v))}%`} style={{ fontSize: 10, fontWeight: 700, fill: r.isBaseline ? '#64748B' : color(r.id) }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <StrategyLegend results={results} strategies={strategies} />
    </div>
  );
}

function WrapTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = String(payload?.value ?? '').split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > 14 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return (
    <text x={x} y={(y ?? 0) + 10} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
      {lines.slice(0, 2).map((l, i) => <tspan key={i} x={x} dy={i ? 12 : 0}>{i === 1 && lines.length > 2 ? l.slice(0, 12) + '…' : l}</tspan>)}
    </text>
  );
}

export function StrategyLegend({ results, strategies }: { results: StrategyResult[]; strategies: Strategy[] }) {
  const colors = useColorMap(strategies);
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-3">
      {results.map(r => (
        <span key={r.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
          <span className={cn('h-3 w-3 rounded-sm', r.isBaseline && 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_2px,#94A3B8_2px_4px)]')} style={r.isBaseline ? undefined : { backgroundColor: colors.get(r.id) }} />
          {r.isBaseline ? 'Témoin sans levier' : r.name}
        </span>
      ))}
    </div>
  );
}

// ============================================================ Superposition des stratégies
export function OverlayChart({ out, strategies, height = 280 }: { out: SimOutput; strategies: Strategy[]; height?: number }) {
  const ticks = useMemo(() => monthTicks(out), [out]);
  const bands = useMemo(() => phenoBands(out), [out]);
  const data = useMemo(() => out.results[0]?.series.map((p, i) => {
    const row: Record<string, number> = { day: p.day };
    out.results.forEach(r => (row[r.id] = r.series[i]?.cherry_all as number));
    return row;
  }) ?? [], [out]);
  const colors = useColorMap(strategies);
  const names = useNameMap(out.results);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          {bands.map((b, i) => <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="#FEE2E2" fillOpacity={0.5} stroke="none" />)}
          <XAxis dataKey="day" type="number" domain={[0, out.totalDays]} ticks={ticks} tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={d => dayLabel(d, out.startDayOfYear).month} />
          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} />
          <ReferenceLine y={THRESHOLD} stroke="#DC2626" strokeDasharray="6 4" />
          <Tooltip labelFormatter={d => { const l = dayLabel(Number(d), out.startDayOfYear); return `${l.label} — Année ${l.year}`; }}
            formatter={(v, n) => [`${fmt(Number(v))} femelles/ha`, names.get(String(n)) ?? String(n)]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {out.results.map(r => (
            <Line key={r.id} dataKey={r.id} type="monotone" dot={false} isAnimationActive={false}
              stroke={colors.get(r.id)} strokeWidth={r.isBaseline ? 2 : 2.5} strokeDasharray={r.isBaseline ? '5 4' : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================ Économie
export function EconomicsChart({ out, strategies, height = 280 }: { out: SimOutput; strategies: Strategy[]; height?: number }) {
  const base = out.results.find(r => r.isBaseline);
  const data = out.results.map(r => ({
    name: r.isBaseline ? 'Témoin' : r.name,
    id: r.id,
    gain: Math.max(0, r.revenue - (base?.revenue ?? 0)),
    net: -r.costs.net, phyto: -r.costs.phyto, labor: -r.costs.labor, bio: -r.costs.bio, tis: -r.costs.tis,
    balance: r.revenue - (base?.revenue ?? 0) - r.totalCost,
  }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} stackOffset="sign" margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => `${Math.round(v / 1000)}k€`} />
          <ReferenceLine y={0} stroke="#0F172A" />
          <Tooltip formatter={(v, n) => [fmtEur(Math.abs(Number(v))), ({ gain: 'CA sauvé vs témoin', net: 'Filets', phyto: 'Produits phyto / bio', labor: 'Main-d’œuvre', bio: 'Parasitoïdes', tis: 'TIS', balance: 'Bilan net' } as Record<string, string>)[String(n)] ?? String(n)]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => ({ gain: 'CA sauvé', net: 'Filets', phyto: 'Phyto/bio', labor: 'Main-d’œuvre', bio: 'Parasitoïdes', tis: 'TIS', balance: 'Bilan net' } as Record<string, string>)[v] ?? v} />
          <Bar dataKey="gain" stackId="a" fill="#16A34A" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="net" stackId="a" fill="#2563EB" isAnimationActive={false} />
          <Bar dataKey="phyto" stackId="a" fill="#D97706" isAnimationActive={false} />
          <Bar dataKey="labor" stackId="a" fill="#0D9488" isAnimationActive={false} />
          <Bar dataKey="bio" stackId="a" fill="#7C3AED" isAnimationActive={false} />
          <Bar dataKey="tis" stackId="a" fill="#DB2777" isAnimationActive={false} />
          <Line dataKey="balance" stroke="#0F172A" strokeWidth={2} dot={{ r: 5, fill: '#0F172A' }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <span className="sr-only">{strategies.length}</span>
    </div>
  );
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

export function RadarScore({ out, strategies, height = 300 }: { out: SimOutput; strategies: Strategy[]; height?: number }) {
  const base = out.results.find(r => r.isBaseline);
  const scores = useMemo(() => scoreStrategies(out.results, base), [out.results, base]);
  const colors = useColorMap(strategies);
  const axes = Object.keys(scores[0]?.s ?? {});
  const data = axes.map(a => { const row: Record<string, string | number> = { axis: a }; scores.forEach(x => (row[x.id] = (x.s as Record<string, number>)[a])); return row; });
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#E2E8F0" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          {out.results.map(r => {
            const c = colors.get(r.id) ?? FALLBACK;
            return <Radar key={r.id} dataKey={r.id} name={r.isBaseline ? 'Témoin' : r.name} stroke={c} fill={c} fillOpacity={r.isBaseline ? 0.05 : 0.15} strokeWidth={2} isAnimationActive={false} />;
          })}
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================ Évolution des fruits sains
export function HealthyFruitChart({ out, parcels, strategies, height = 260 }: { out: SimOutput; parcels: Parcel[]; strategies: Strategy[]; height?: number }) {
  const ticks = useMemo(() => monthTicks(out), [out]);
  // dépendance stable : avant, `cherry` était recréé à chaque rendu et invalidait le useMemo
  const cherry = useMemo(() => parcels.filter(p => isCherry(p.type)), [parcels]);
  const data = useMemo(() => out.results[0]?.damageSeries.map((p, i) => {
    const row: Record<string, number> = { day: p.day };
    out.results.forEach(r => {
      let s = 0, n = 0;
      cherry.forEach(c => { const v = r.damageSeries[i]?.[c.id]; if (typeof v === 'number') { s += v * c.area; n += c.area; } });
      row[r.id] = n ? s / n : 100;
    });
    return row;
  }) ?? [], [out, cherry]);
  const colors = useColorMap(strategies);
  const names = useNameMap(out.results);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="day" type="number" domain={[0, out.totalDays]} ticks={ticks} tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={d => dayLabel(d, out.startDayOfYear).month} />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748B' }} />
          <Tooltip labelFormatter={d => { const l = dayLabel(Number(d), out.startDayOfYear); return `${l.label} — Année ${l.year}`; }}
            formatter={(v, n) => [`${Number(v).toFixed(1)} % de fruits sains`, names.get(String(n)) ?? String(n)]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {out.results.map(r => <Line key={r.id} dataKey={r.id} type="stepAfter" dot={false} isAnimationActive={false} stroke={colors.get(r.id)} strokeWidth={2} strokeDasharray={r.isBaseline ? '5 4' : undefined} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================ Récolte par année
export function YearlyHarvestChart({ result, parcels, height = 220 }: { result: StrategyResult; parcels: Parcel[]; height?: number }) {
  const cherry = useMemo(() => parcels.filter(p => isCherry(p.type)), [parcels]);
  const cherryName = useMemo(() => new Map(cherry.map(c => [c.id, c.name])), [cherry]);
  const years = Math.max(0, ...cherry.map(p => result.harvestByParcelYear[p.id]?.length ?? 0));
  const data = Array.from({ length: years }, (_, y) => {
    const row: Record<string, string | number> = { year: `Année ${y + 1}` };
    cherry.forEach(p => (row[p.id] = Math.round(result.harvestByParcelYear[p.id]?.[y] ?? 0)));
    return row;
  });
  if (!years) return <Empty>Aucune récolte simulée.</Empty>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#334155' }} />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748B' }} />
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v, n) => [`${v} %`, cherryName.get(String(n)) ?? String(n)]} />
          {cherry.map(p => (
            <Bar key={p.id} dataKey={p.id} fill={p.color} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey={p.id} position="top" style={{ fontSize: 9, fill: '#334155', fontWeight: 700 }} formatter={(v: unknown) => `${v}%`} />
              {data.map((_, i) => <Cell key={i} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs italic text-slate-400">{children}</div>;
}

export { TYPE_LABEL };
