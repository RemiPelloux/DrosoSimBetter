'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppHeader, LiveBadge, download, toast, useShareHydration } from '@/components/AppHeader';
import {
  PopulationChart, HarvestByParcelChart, OverlayChart, EconomicsChart, RadarScore, HealthyFruitChart, YearlyHarvestChart,
  StrategyLegend, fmtEur, THRESHOLD, Empty,
} from '@/components/charts';
import { MiniMap, heat } from '@/components/GridEditor';
import { LEVERS, SimulationSettings, EconomicsSettings } from '@/components/ControlPanel';
import { useGridStore, type Strategy } from '@/lib/store';
import { useSimulation } from '@/lib/useSimulation';
import { dayLabel, isCherry, PHENOLOGY, type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Trophy, TrendingUp, TrendingDown, Euro, Bug, Leaf, Activity, BarChart3, Layers, Columns3, Map as MapIcon,
  Lightbulb, AlertTriangle, CheckCircle2, Info, ChevronDown, Printer, Settings2, Clock, Users, Radar as RadarIcon,
} from 'lucide-react';

export default function ResultsPage() {
  useShareHydration();
  const strategies = useGridStore(s => s.strategies);
  const grid = useGridStore(s => s.grid);
  const simParams = useGridStore(s => s.simParams);
  const economics = useGridStore(s => s.economics);
  const { out, running, parcels } = useSimulation();
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<'columns' | 'overlay'>('columns');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // impression automatique (?print=1)
  useEffect(() => {
    if (!out) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('print') === '1') {
      p.delete('print');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => window.print(), 600);
    }
  }, [out]);

  const shown = useMemo(() => {
    if (!out) return null;
    return { ...out, results: out.results.filter(r => r.isBaseline || !excluded[r.id]) };
  }, [out, excluded]);

  const base = out?.results.find(r => r.isBaseline);
  const ranked = useMemo(() => (shown?.results ?? []).filter(r => !r.isBaseline).map(r => ({ r, net: r.revenue - (base?.revenue ?? 0) - r.totalCost })).sort((a, b) => b.net - a.net), [shown, base]);
  const best = ranked[0];
  const focus = shown?.results.find(r => r.id === (focusId ?? best?.r.id)) ?? shown?.results[0];
  const color = (id: string) => strategies.find(s => s.id === id)?.color ?? '#64748B';
  const haPerCell = economics.cellAreaM2 / 10000;
  const cherryHa = parcels.filter(p => isCherry(p.type)).reduce((a, p) => a + p.area, 0) * haPerCell;

  const exportCsv = () => {
    if (!out) return;
    const head = ['jour', 'date', 'annee'];
    const cols: [StrategyResult, string, string][] = [];
    out.results.forEach(r => {
      parcels.forEach(p => { head.push(`${r.name} | ${p.name} (femelles/ha)`); cols.push([r, p.id, 'pop']); });
      parcels.filter(p => isCherry(p.type)).forEach(p => { head.push(`${r.name} | ${p.name} (% fruits sains)`); cols.push([r, p.id, 'dmg']); });
    });
    const rows = [head.join(';')];
    out.results[0].series.forEach((pt, i) => {
      const l = dayLabel(pt.day, out.startDayOfYear);
      rows.push([pt.day, l.label, l.year, ...cols.map(([r, pid, k]) => (k === 'pop' ? r.series[i]?.[pid] : r.damageSeries[i]?.[pid]) ?? '')].join(';'));
    });
    rows.push('', 'SYNTHESE;strategie;recolte_%;pic_femelles_ha;IFT;cout_eur;CA_eur;bilan_vs_temoin_eur;main_oeuvre_h');
    out.results.forEach(r => rows.push(['', r.name, r.globalHarvest, r.peakDensity, r.ift, r.totalCost, r.revenue, r.revenue - (base?.revenue ?? 0) - r.totalCost, r.laborHours].join(';')));
    download(`drososim-series-${new Date().toISOString().slice(0, 10)}.csv`, '\ufeff' + rows.join('\n'), 'text/csv;charset=utf-8');
    toast('Séries temporelles exportées (.csv)');
  };

  if (parcels.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title="Résultats" step={2} />
        <div className="mx-auto mt-24 max-w-md text-center">
          <BarChart3 className="mx-auto h-14 w-14 text-slate-300" />
          <h2 className="mt-4 text-xl font-extrabold text-slate-900">Aucun verger à analyser</h2>
          <p className="mt-2 text-sm text-slate-500">Dessinez d&apos;abord vos parcelles, ou chargez la démo.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/simulator" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Dessiner mon verger</Link>
            <button onClick={() => useGridStore.getState().loadDemo()} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Charger la démo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title="Résultats & comparateur" subtitle="Bilan technico-économique multi-stratégies" step={2} onCsv={exportCsv}
        right={<button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><Printer className="h-4 w-4" /> <span className="hidden sm:inline">Fiche Conseil PDF</span></button>} />

      <main className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
        {/* En-tête impression */}
        <div className="hidden print:block">
          <div className="flex items-start justify-between border-b-2 border-emerald-700 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Fiche Conseil — Drosophila suzukii</p>
              <h1 className="text-2xl font-extrabold text-slate-900">Comparatif de stratégies de protection</h1>
              <p className="text-xs text-slate-500">Édité le {new Date().toLocaleDateString('fr-FR')} · DrosoSim Next</p>
            </div>
            <MiniMap grid={grid} size={110} />
          </div>
        </div>

        {/* Bandeau scénario */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="no-print flex flex-wrap items-center gap-2">
          <Link href="/simulator" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-3.5 w-3.5" /> Modifier le verger</Link>
          <Chip icon={MapIcon}>{parcels.length} parcelles · {cherryHa.toFixed(2)} ha de cerisiers</Chip>
          <Chip icon={Clock}>{simParams.durationYears} an{simParams.durationYears > 1 ? 's' : ''} · départ {simParams.startSeason === 'spring' ? 'printemps' : 'automne'}</Chip>
          <Chip icon={Leaf}>{({ 'mild-winter': 'Hiver doux', 'harsh-winter': 'Hiver rigoureux', 'humid-spring': 'Printemps humide', 'dry-summer': 'Été caniculaire' })[simParams.climateProfile]}</Chip>
          <Chip icon={Euro}>{economics.yieldTPerHa} t/ha · {economics.pricePerKg.toFixed(2)} €/kg</Chip>
          <button onClick={() => setShowSettings(v => !v)} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
            <Settings2 className="h-3.5 w-3.5" /> Réglages rapides <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showSettings && 'rotate-180')} />
          </button>
          <span className="ml-auto"><LiveBadge running={running} ms={out?.computeMs} /></span>
        </motion.div>
        {showSettings && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="no-print grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
            <SimulationSettings />
            <div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Hypothèses économiques</p><EconomicsSettings /><p className="mt-2 text-[11px] text-slate-500">Toute modification relance instantanément la simulation des {strategies.length} stratégies.</p></div>
          </motion.div>
        )}

        {!shown || !base ? <SkeletonResults /> : (
          <>
            {/* Verdict */}
            {best && <Verdict best={best.r} net={best.net} base={base} color={color(best.r.id)} count={ranked.length} />}

            {/* Sélection & mode */}
            <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <span className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Stratégies comparées</span>
              {out!.results.map(r => (
                <button key={r.id} disabled={r.isBaseline} onClick={() => setExcluded(e => ({ ...e, [r.id]: !e[r.id] }))}
                  className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all', excluded[r.id] ? 'border-dashed border-slate-300 text-slate-400 line-through' : 'border-slate-200 bg-slate-50 text-slate-800', r.isBaseline && 'cursor-default')}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color(r.id) }} />{r.isBaseline ? 'Témoin (toujours affiché)' : r.name}
                </button>
              ))}
              <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5">
                <ModeBtn active={mode === 'columns'} onClick={() => setMode('columns')} icon={Columns3}>Côte à côte</ModeBtn>
                <ModeBtn active={mode === 'overlay'} onClick={() => setMode('overlay')} icon={Layers}>Superposition</ModeBtn>
              </div>
            </div>

            {/* KPIs côte à côte */}
            <section className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${shown.results.length > 3 ? 240 : 280}px, 1fr))` }}>
              {shown.results.map((r, i) => <StrategyCard key={r.id} r={r} base={base} color={color(r.id)} best={best?.r.id === r.id} delay={i * 0.05} onFocus={() => setFocusId(r.id)} focused={focus?.id === r.id} />)}
            </section>

            {/* Graphique 1 + rendement annuel */}
            <div className="grid gap-5 xl:grid-cols-3">
              <Card className="xl:col-span-2" title="Récolte saine par parcelle" icon={BarChart3} subtitle="Valeur exacte au sommet de chaque barre · barre hachurée = témoin sans levier">
                <HarvestByParcelChart out={shown} parcels={parcels} strategies={strategies} height={300} />
              </Card>
              <Card title="Récolte année par année" icon={TrendingUp} subtitle={focus ? `Stratégie : ${focus.isBaseline ? 'Témoin' : focus.name}` : ''} right={<FocusPicker results={shown.results} value={focus?.id} onChange={setFocusId} color={color} />}>
                {focus && <YearlyHarvestChart result={focus} parcels={parcels} height={300} />}
              </Card>
            </div>

            {/* Graphique 2 : dynamique */}
            <Card title={mode === 'overlay' ? 'Pression moyenne sur les cerisiers — superposition des stratégies' : 'Dynamique des populations de femelles'} icon={Activity}
              subtitle={mode === 'overlay' ? 'Bandes rouges = périodes de sensibilité des fruits' : 'Légende cliquable · bandes = maturité des fruits · 🚜 traitement 🛡️ filet 🧺 récolte 🐝 parasitoïdes 🧬 TIS'}
              right={mode === 'columns' ? <FocusPicker results={shown.results} value={focus?.id} onChange={setFocusId} color={color} /> : undefined}>
              {mode === 'overlay'
                ? <><OverlayChart out={shown} strategies={strategies} height={360} /><StrategyLegend results={shown.results} strategies={strategies} /></>
                : focus && <PopulationChart out={shown} result={focus} parcels={parcels} height={380} />}
              <PhenologyNote />
            </Card>

            {/* Économie + radar */}
            <div className="grid gap-5 lg:grid-cols-2 print-break">
              <Card title="Bilan économique annuel" icon={Euro} subtitle="CA sauvé vs témoin (vert) face aux coûts des leviers · ● bilan net">
                <EconomicsChart out={shown} strategies={strategies} height={320} />
              </Card>
              <Card title="Profil multicritère" icon={RadarIcon} subtitle="0-100 : plus la surface est grande, meilleure est la stratégie">
                <RadarScore out={shown} strategies={strategies} height={300} />
                <StrategyLegend results={shown.results} strategies={strategies} />
              </Card>
            </div>

            {/* Fruits sains + carte de chaleur */}
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="lg:col-span-2" title="Évolution des fruits sains (cerisiers)" icon={Leaf} subtitle="% de fruits indemnes, pondéré par la surface — chute pendant la fenêtre de sensibilité">
                <HealthyFruitChart out={shown} parcels={parcels} strategies={strategies} height={300} />
                <StrategyLegend results={shown.results} strategies={strategies} />
              </Card>
              <Card title="Carte de pression maximale" icon={MapIcon} subtitle="Pic de femelles/ha atteint dans chaque case" right={<FocusPicker results={shown.results} value={focus?.id} onChange={setFocusId} color={color} />}>
                {focus && <HeatPanel focus={focus} base={base} grid={grid} />}
              </Card>
            </div>

            {/* Matrice des leviers */}
            <Card title="Leviers retenus par stratégie" icon={Layers} subtitle="Récapitulatif complet — rien n'est tronqué">
              <LeverTable strategies={strategies.filter(s => shown.results.some(r => r.id === s.id))} parcels={parcels} results={shown.results} haPerCell={haPerCell} />
            </Card>

            {/* Recommandations + coûts */}
            <div className="grid gap-5 lg:grid-cols-2">
              <Recommendations results={shown.results} base={base} parcels={parcels} />
              <Card title="Détail des coûts & contraintes" icon={Users} subtitle="Par an, sur l'ensemble de l'exploitation">
                <CostTable results={shown.results.filter(r => !r.isBaseline)} base={base} color={color} />
              </Card>
            </div>

            <Hypotheses />
          </>
        )}
      </main>
    </div>
  );
}

// ======================================================================= Blocs
function Verdict({ best, net, base, color, count }: { best: StrategyResult; net: number; base: StrategyResult; color: string; count: number }) {
  const gainPts = best.globalHarvest - base.globalHarvest;
  return (
    <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-6 text-white shadow-xl">
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: `${color}55` }} />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300"><Trophy className="h-4 w-4" /> {count > 1 ? `Meilleure stratégie sur ${count}` : 'Stratégie évaluée'}</p>
          <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{best.name}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Préserve <b className="text-white">{best.globalHarvest.toFixed(0)} %</b> de la récolte ({gainPts >= 0 ? '+' : ''}{gainPts.toFixed(0)} pts vs témoin) pour un bilan net de{' '}
            <b className={net >= 0 ? 'text-emerald-300' : 'text-red-300'}>{fmtEur(net)}</b> par an, avec un IFT chimique de <b className="text-white">{best.ift.toFixed(1)}</b>.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <BigStat label="Récolte" value={`${best.globalHarvest.toFixed(0)}%`} sub={`témoin ${base.globalHarvest.toFixed(0)}%`} />
          <BigStat label="Bilan net / an" value={`${net >= 0 ? '+' : ''}${(net / 1000).toFixed(1)}k€`} sub={`coût ${fmtEur(best.totalCost)}`} />
          <BigStat label="Pic mouches" value={`${(best.peakDensity / 1000).toFixed(1)}k`} sub={`témoin ${(base.peakDensity / 1000).toFixed(0)}k /ha`} />
        </div>
      </div>
    </motion.section>
  );
}

function StrategyCard({ r, base, color, best, delay, onFocus, focused }: { r: StrategyResult; base: StrategyResult; color: string; best: boolean; delay: number; onFocus: () => void; focused: boolean }) {
  const d = r.globalHarvest - base.globalHarvest;
  const saved = r.revenue - base.revenue;
  const net = saved - r.totalCost;
  const iftTone = r.ift === 0 ? 'bg-emerald-500' : r.ift <= 2 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} onClick={onFocus}
      className={cn('relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md', focused ? 'ring-2 ring-offset-2' : 'border-slate-200')}
      style={focused ? { ['--tw-ring-color' as string]: color } : undefined}>
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: r.isBaseline ? 'repeating-linear-gradient(45deg,#CBD5E1 0 6px,#94A3B8 6px 12px)' : color }} />
      <div className="mb-3 flex items-center gap-2">
        <span className="truncate text-sm font-extrabold text-slate-900">{r.isBaseline ? 'Témoin sans protection' : r.name}</span>
        {best && <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"><Trophy className="h-3 w-3" /> Meilleur bilan</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={TrendingUp} label="Récolte préservée" value={`${r.globalHarvest.toFixed(1)} %`}
          badge={r.isBaseline ? 'référence' : `${d >= 0 ? '+' : ''}${d.toFixed(1)} pts vs témoin`} tone={r.isBaseline ? 'neutral' : d > 0.5 ? 'good' : d < -0.5 ? 'bad' : 'neutral'} />
        <Kpi icon={Euro} label="Bilan net / an" value={r.isBaseline ? '—' : fmtEur(net)}
          badge={r.isBaseline ? `CA ${fmtEur(r.revenue)}` : `CA sauvé ${fmtEur(saved)} · coût ${fmtEur(r.totalCost)}`} tone={r.isBaseline ? 'neutral' : net >= 0 ? 'good' : 'bad'} />
        <Kpi icon={Bug} label="Pic femelles/ha" value={`${r.peakDensity.toLocaleString('fr-FR')}`}
          badge={r.isBaseline ? (r.peakDensity > THRESHOLD ? 'au-dessus du seuil' : 'sous le seuil') : `${Math.round((r.peakDensity / Math.max(1, base.peakDensity) - 1) * 100)} % vs témoin`}
          tone={r.isBaseline ? 'neutral' : r.peakDensity < base.peakDensity * 0.9 ? 'good' : r.peakDensity > THRESHOLD ? 'bad' : 'neutral'} />
        <div>
          <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><Leaf className="h-3 w-3" /> IFT chimique</p>
          <p className="text-lg font-extrabold text-slate-900">{r.ift.toFixed(1)}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200">
            <div className={cn('h-full rounded-full', iftTone)} style={{ width: `${Math.max(4, Math.min(100, (r.ift / 5) * 100))}%` }} />
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">{r.laborHours} h main-d&apos;œuvre</p>
        </div>
      </div>
    </motion.button>
  );
}

function HeatPanel({ focus, base, grid }: { focus: StrategyResult; base: StrategyResult; grid: import('@/lib/engine').CellType[] }) {
  const max = Math.max(...Array.from(base.peakByCell), 1);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-3">
        <div className="text-center"><MiniMap grid={grid} values={focus.peakByCell} max={max} size={180} /><p className="mt-1 text-[11px] font-bold text-slate-700">{focus.isBaseline ? 'Témoin' : focus.name}</p></div>
        <div className="hidden text-center sm:block"><MiniMap grid={grid} size={110} /><p className="mt-1 text-[11px] text-slate-500">Plan du verger</p></div>
      </div>
      <div className="w-full">
        <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.33, 0.66, 1].map(heat).join(',')})` }} />
        <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>0</span><span>{Math.round(max / 2).toLocaleString('fr-FR')}</span><span>{Math.round(max).toLocaleString('fr-FR')} /ha</span></div>
        <p className="mt-2 text-[11px] text-slate-500">Échelle commune au témoin : les zones claires montrent l&apos;effet protecteur. Le réservoir sauvage alimente les bordures.</p>
      </div>
    </div>
  );
}

function LeverTable({ strategies, parcels, results, haPerCell }: { strategies: Strategy[]; parcels: import('@/lib/store').Parcel[]; results: StrategyResult[]; haPerCell: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3">Parcelle</th><th className="py-2 pr-3">Surface</th>
            {strategies.map(s => <th key={s.id} className="py-2 pr-3"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.isBaseline ? 'Témoin' : s.name}</span></th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {parcels.map(p => (
            <tr key={p.id}>
              <td className="py-2 pr-3 font-semibold text-slate-800"><span className="flex items-center gap-2"><span className={cn('h-3 w-3 rounded', p.type === 'forest' && 'hatch')} style={{ backgroundColor: p.color }} />{p.name}</span></td>
              <td className="py-2 pr-3 font-mono text-slate-500">{(p.area * haPerCell).toFixed(2)} ha</td>
              {strategies.map(s => {
                const lv = s.leversByParcel[p.id];
                const on = LEVERS.filter(l => lv?.[l.key] && l.targets(p.type));
                const h = results.find(r => r.id === s.id)?.harvestByParcel[p.id];
                return (
                  <td key={s.id} className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {on.length ? on.map(l => (
                        <span key={l.key} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: l.color }} title={l.label}>
                          <l.icon className="h-3 w-3" />{l.short}
                          {l.key === 'treatment' && lv && <span className="opacity-80">×{lv.treatmentPasses}{lv.treatmentMode === 'biocontrol' ? ' bio' : ''}</span>}
                          {l.key === 'netting' && lv && <span className="opacity-80">{lv.netType === 'monorang' ? 'mono' : 'parc.'}</span>}
                        </span>
                      )) : <span className="text-slate-300">—</span>}
                      {h !== undefined && <span className={cn('ml-1 font-mono text-[10px] font-bold', h >= 90 ? 'text-emerald-600' : h >= 70 ? 'text-amber-600' : 'text-red-600')}>{h.toFixed(0)}%</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostTable({ results, base, color }: { results: StrategyResult[]; base: StrategyResult; color: (id: string) => string }) {
  if (!results.length) return <Empty>Ajoutez une stratégie pour voir le détail des coûts.</Empty>;
  const rows: [string, (r: StrategyResult) => string][] = [
    ['Filets (amortis)', r => fmtEur(r.costs.net)], ['Produits phyto / bio', r => fmtEur(r.costs.phyto)], ['Main-d’œuvre (pose, passages, prophylaxie)', r => fmtEur(r.costs.labor)],
    ['Parasitoïdes', r => fmtEur(r.costs.bio)], ['TIS', r => fmtEur(r.costs.tis)], ['Coût total', r => fmtEur(r.totalCost)],
    ['CA sauvé vs témoin', r => fmtEur(r.revenue - base.revenue)], ['Bilan net', r => fmtEur(r.revenue - base.revenue - r.totalCost)],
    ['Retour sur investissement', r => (r.totalCost ? `${Math.round(((r.revenue - base.revenue) / r.totalCost) * 100)} %` : '—')],
    ['Heures de travail', r => `${r.laborHours} h`], ['IFT chimique', r => r.ift.toFixed(1)],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500"><th className="py-2 pr-3" />{results.map(r => <th key={r.id} className="py-2 pr-3 text-right"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color(r.id) }} />{r.name}</span></th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([l, f]) => (
            <tr key={l} className={cn(['Coût total', 'Bilan net'].includes(l) && 'bg-slate-50 font-bold')}>
              <td className="py-1.5 pr-3 text-slate-600">{l}</td>
              {results.map(r => <td key={r.id} className="py-1.5 pr-3 text-right font-mono text-slate-900">{f(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Recommendations({ results, base, parcels }: { results: StrategyResult[]; base: StrategyResult; parcels: import('@/lib/store').Parcel[] }) {
  const recs: { tone: 'good' | 'warn' | 'info'; text: React.ReactNode }[] = [];
  const strats = results.filter(r => !r.isBaseline);
  const cherry = parcels.filter(p => isCherry(p.type));
  // parcelles les plus exposées dans le témoin
  const worst = [...cherry].sort((a, b) => (base.harvestByParcel[a.id] ?? 100) - (base.harvestByParcel[b.id] ?? 100))[0];
  if (worst && (base.harvestByParcel[worst.id] ?? 100) < 85)
    recs.push({ tone: 'warn', text: <>Sans protection, <b>{worst.name}</b> ne conserve que <b>{base.harvestByParcel[worst.id]?.toFixed(0)} %</b> de sa récolte : c&apos;est la parcelle prioritaire ({PHENOLOGY[worst.type].label.toLowerCase()}, mûre quand la population atteint son pic).</> });
  const early = cherry.filter(p => p.type === 'early-cherry' && (base.harvestByParcel[p.id] ?? 0) > 90);
  if (early.length) recs.push({ tone: 'info', text: <>Les variétés précoces ({early.map(p => p.name).join(', ')}) sont récoltées avant l&apos;explosion estivale : une protection légère suffit souvent.</> });
  if (strats.length) {
    const byNet = [...strats].sort((a, b) => (b.revenue - b.totalCost) - (a.revenue - a.totalCost));
    const top = byNet[0];
    recs.push({ tone: 'good', text: <><b>{top.name}</b> offre le meilleur bilan économique ({fmtEur(top.revenue - base.revenue - top.totalCost)} / an vs témoin).</> });
    const green = [...strats].sort((a, b) => a.ift - b.ift || b.globalHarvest - a.globalHarvest)[0];
    if (green.id !== top.id && green.ift < top.ift) recs.push({ tone: 'info', text: <>Pour réduire l&apos;IFT, <b>{green.name}</b> (IFT {green.ift.toFixed(1)}) préserve {green.globalHarvest.toFixed(0)} % de la récolte.</> });
    strats.forEach(s => { if (s.revenue - base.revenue - s.totalCost < 0) recs.push({ tone: 'warn', text: <><b>{s.name}</b> coûte plus qu&apos;elle ne rapporte ({fmtEur(s.revenue - base.revenue - s.totalCost)} / an) : ciblez les leviers sur les parcelles les plus exposées.</> }); });
    strats.forEach(s => { if (s.peakDensity > THRESHOLD * 4) recs.push({ tone: 'warn', text: <>Avec <b>{s.name}</b>, la pression dépasse encore largement le seuil ({s.peakDensity.toLocaleString('fr-FR')} femelles/ha) : risque de résistance et de dégâts tardifs.</> }); });
    const hasMultiYear = Object.values(strats[0].harvestByParcelYear).some(a => a.length > 1);
    if (hasMultiYear) {
      const decl = strats.find(s => Object.values(s.harvestByParcelYear).some(a => a.length > 1 && a[a.length - 1] < a[0] - 10));
      if (decl) recs.push({ tone: 'warn', text: <>Avec <b>{decl.name}</b>, la récolte se dégrade d&apos;année en année : le réservoir n&apos;est pas maîtrisé. Envisagez prophylaxie et parasitoïdes dans les espaces naturels.</> });
    }
  } else recs.push({ tone: 'info', text: <>Créez une stratégie dans l&apos;éditeur pour obtenir des recommandations comparatives.</> });
  if (parcels.some(p => p.type === 'forest')) recs.push({ tone: 'info', text: <>Les espaces naturels servent de réservoir hivernal : les lâchers de parasitoïdes y agissent sur le long terme (années 2-3).</> });

  const I = { good: CheckCircle2, warn: AlertTriangle, info: Lightbulb };
  const C = { good: 'text-emerald-600 bg-emerald-50', warn: 'text-amber-600 bg-amber-50', info: 'text-blue-600 bg-blue-50' };
  return (
    <Card title="Recommandations" icon={Lightbulb} subtitle="Générées automatiquement à partir des résultats de la simulation">
      <ul className="space-y-2">
        {recs.map((r, i) => { const Ic = I[r.tone]; return (
          <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-2.5 rounded-xl border border-slate-100 p-2.5 text-xs leading-relaxed text-slate-700">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', C[r.tone])}><Ic className="h-3.5 w-3.5" /></span><span>{r.text}</span>
          </motion.li>); })}
      </ul>
    </Card>
  );
}

function Hypotheses() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 p-4 text-left">
        <Info className="h-4 w-4 text-slate-500" /><span className="text-sm font-bold text-slate-800">Hypothèses du modèle (transparence pour chercheurs et conseillers)</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-600 md:grid-cols-2">
          <div>
            <p className="mb-1 font-bold text-slate-800">Dynamique (pas journalier, grille 20×20)</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Compartiments par case : immatures L (œuf→pupe, ~210 degrés-jours au-dessus de 8 °C) et femelles adultes A.</li>
              <li>Ponte = 6 œufs/j × aptitude thermique (optimum 20-26 °C, arrêt &gt; 33 °C) × ressource fruitière × densité-dépendance.</li>
              <li>Mortalité adulte 2,8 %/j, majorée par le froid (selon profil d&apos;hiver), la chaleur &gt; 30 °C et les zones non cultivées.</li>
              <li>Dispersion : 12 %/j (3 % par temps froid) vers les 8 voisines, pondérée par l&apos;attractivité (cerisiers en véraison ×3).</li>
              <li>Fruits sains : décroissance exponentielle avec les œufs pondus pendant la fenêtre véraison → récolte.</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-bold text-slate-800">Leviers</p>
            <ul className="list-disc space-y-1 pl-4">
              <li><b>Filet</b> : accès aux fruits −95 % (monorang) / −85 % (monoparcelle) et immigration −67/−60 %.</li>
              <li><b>Traitement</b> : mortalité +32 %/j pendant 7 j (chimie) ou +16 %/j pendant 4 j (biocontrôle), rémanence −40 % si printemps humide, DAR 3 j.</li>
              <li><b>Prophylaxie</b> : fruits résiduels = 1 − taux de récolte ; ×0,25 si destruction des fruits au sol.</li>
              <li><b>Parasitoïdes</b> : survie larvaire jusqu&apos;à −38 % (×1,4 en dose renforcée), installation progressive sur 3 ans.</li>
              <li><b>TIS</b> : fécondité fertile ÷ (1 + 0,12 × ratio) de mars à septembre.</li>
              <li>Économie : CA = surface × rendement × prix × % fruits sains. Coûts par défaut/ha/an (filet 2 600-3 800 €, MO 16 €/h incluant pose des filets et passages, phyto 85-150 €/passage, parasitoïdes 300-520 €, TIS 950 €) — tous modifiables dans « Hypothèses économiques ».</li>
            </ul>
            <p className="mt-2 italic text-slate-400">Modèle pédagogique d&apos;aide à la décision, non calibré sur données terrain : comparer les ordres de grandeur, pas les valeurs absolues.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function PhenologyNote() {
  return <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><Info className="h-3.5 w-3.5" /> Le pic de juillet détruit la cerise tardive mais épargne la précoce, déjà récoltée : les bandes colorées matérialisent ces fenêtres de sensibilité.</p>;
}

// ======================================================================= Atoms
function Card({ title, icon: Icon, subtitle, children, right, className }: { title: string; icon: React.ElementType; subtitle?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className={cn('break-inside-avoid rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-extrabold text-slate-900">{title}</h3>{subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}</div>
        {right && <div className="no-print">{right}</div>}
      </div>
      {children}
    </motion.section>
  );
}
function Kpi({ icon: Icon, label, value, badge, tone }: { icon: React.ElementType; label: string; value: string; badge?: string; tone: 'good' | 'bad' | 'neutral' }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><Icon className="h-3 w-3" /> {label}</p>
      <p className="text-lg font-extrabold text-slate-900">{value}</p>
      {badge && <p className={cn('mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold', tone === 'good' ? 'bg-emerald-50 text-emerald-700' : tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600')}>
        {tone === 'good' ? <TrendingUp className="h-3 w-3" /> : tone === 'bad' ? <TrendingDown className="h-3 w-3" /> : null}{badge}</p>}
    </div>
  );
}
function BigStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-300">{label}</p><p className="text-2xl font-extrabold">{value}</p><p className="text-[10px] text-slate-400">{sub}</p></div>;
}
function Chip({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"><Icon className="h-3.5 w-3.5 text-slate-400" />{children}</span>;
}
function ModeBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold', active ? 'bg-white text-slate-900 shadow' : 'text-slate-500')}><Icon className="h-3.5 w-3.5" />{children}</button>;
}
function FocusPicker({ results, value, onChange, color }: { results: StrategyResult[]; value?: string; onChange: (id: string) => void; color: (id: string) => string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700" style={{ borderLeft: `4px solid ${value ? color(value) : '#ccc'}` }}>
      {results.map(r => <option key={r.id} value={r.id}>{r.isBaseline ? 'Témoin' : r.name}</option>)}
    </select>
  );
}
function SkeletonResults() {
  return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/60" />)}</div>;
}
