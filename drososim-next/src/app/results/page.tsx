'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppHeader, LiveBadge, download, toast, useShareHydration } from '@/components/AppHeader';
import {
  PopulationChart, HarvestByParcelChart, OverlayChart, EconomicsChart, RadarScore, HealthyFruitChart, YearlyHarvestChart,
  StrategyLegend, fmtEur, THRESHOLD, Empty,
} from '@/components/charts';
import { MiniMap } from '@/components/GridEditor';
import { LEVERS, SimulationSettings, EconomicsSettings } from '@/components/ControlPanel';
import { useGridStore, type Strategy } from '@/lib/store';
import { useSimulation } from '@/lib/useSimulation';
import { dayLabel, isCherry, PHENOLOGY, type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { projectPayload } from '@/lib/projectIO';
import { BuzzingFly, FlyingFlies } from '@/components/illustrations';
import { CountUp, RingGauge, Sparkline, Chapter, Grain, Contours, IsoOrchard, HillsBackdrop } from '@/components/art';
import {
  ArrowLeft, Trophy, TrendingUp, Euro, Bug, Leaf, Activity, BarChart3, Layers, Columns3, Map as MapIcon,
  Lightbulb, AlertTriangle, CheckCircle2, Info, ChevronDown, Printer, Settings2, Clock, Users, Radar as RadarIcon,
} from 'lucide-react';

export default function ResultsPage() {
  useShareHydration();
  const strategies = useGridStore(s => s.strategies);
  const grid = useGridStore(s => s.grid);
  const simParams = useGridStore(s => s.simParams);
  const economics = useGridStore(s => s.economics);
  const { out, running, parcels, source } = useSimulation();
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
    rows.push('', `DROSOSIM-PROJECT;${projectPayload()}`);
    download(`drososim-series-${new Date().toISOString().slice(0, 10)}.csv`, '\ufeff' + rows.join('\n'), 'text/csv;charset=utf-8');
    toast('Séries temporelles exportées (.csv)');
  };

  if (parcels.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title="Résultats" step={2} />
        <div className="mx-auto mt-24 max-w-md text-center">
          <BuzzingFly size={72} />
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

  const climateLabel = ({ 'mild-winter': 'Hiver doux', 'harsh-winter': 'Hiver rigoureux', 'humid-spring': 'Printemps humide', 'dry-summer': 'Été caniculaire' } as const)[simParams.climateProfile];

  return (
    <div className="min-h-screen bg-[#F6F4EE]">
      <AppHeader title="Résultats & comparateur" subtitle="Bilan technico-économique multi-stratégies" step={2} onCsv={exportCsv}
        right={<button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><Printer className="h-4 w-4" /> <span className="hidden sm:inline">Fiche Conseil PDF</span></button>} />

      {/* En-tête impression */}
      <div className="hidden px-6 pt-4 print:block">
        <div className="flex items-start justify-between border-b-2 border-emerald-700 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Fiche Conseil — Drosophila suzukii</p>
            <h1 className="text-2xl font-extrabold text-slate-900">Comparatif de stratégies de protection</h1>
            <p className="text-xs text-slate-500">Édité le {new Date().toLocaleDateString('fr-FR')} · DrosoSim Next · {parcels.length} parcelles · {cherryHa.toFixed(2)} ha de cerisiers · {simParams.durationYears} an(s) · {climateLabel}</p>
          </div>
          <MiniMap grid={grid} size={110} />
        </div>
      </div>

      {!shown || !base ? <main className="mx-auto max-w-[1500px] p-6"><SkeletonResults /></main> : (
        <>
          <Hero best={best?.r} net={best?.net ?? 0} base={base} count={ranked.length} color={best ? color(best.r.id) : '#10B981'} grid={grid}
            running={running} ms={out?.computeMs} source={source}
            chips={[
              { icon: MapIcon, label: `${parcels.length} parcelles · ${cherryHa.toFixed(2)} ha de cerisiers` },
              { icon: Clock, label: `${simParams.durationYears} an${simParams.durationYears > 1 ? 's' : ''} · départ ${simParams.startSeason === 'spring' ? 'printemps' : 'automne'}` },
              { icon: Leaf, label: climateLabel },
              { icon: Euro, label: `${economics.yieldTPerHa} t/ha · ${economics.pricePerKg.toFixed(2)} €/kg` },
            ]}
            settingsOpen={showSettings} onToggleSettings={() => setShowSettings(v => !v)} />

          {showSettings && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="no-print relative z-20 mx-auto -mt-6 grid max-w-[1400px] gap-6 rounded-[28px] border border-white bg-white/95 p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur md:grid-cols-2">
              <SimulationSettings />
              <div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Hypothèses économiques</p><EconomicsSettings /><p className="mt-2 text-[11px] text-slate-500">Toute modification relance instantanément la simulation des {strategies.length} stratégies.</p></div>
            </motion.div>
          )}

          <ChapterNav />

          <main className="relative mx-auto max-w-[1500px] space-y-24 px-4 pb-24 pt-12 md:px-8">
            <Chapter id="synthese" n="01" kicker="Synthèse" title={<>Le classement des <em className="text-emerald-700">stratégies</em></>}>
              <div className="no-print mb-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Comparer</span>
                {out!.results.map(r => (
                  <button key={r.id} disabled={r.isBaseline} onClick={() => setExcluded(e => ({ ...e, [r.id]: !e[r.id] }))}
                    className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all', excluded[r.id] ? 'border-dashed border-slate-300 bg-transparent text-slate-400 line-through' : 'border-white bg-white text-slate-800 shadow-sm hover:shadow', r.isBaseline && 'cursor-default')}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color(r.id) }} />{r.isBaseline ? 'Témoin' : r.name}
                  </button>
                ))}
                <div className="ml-auto flex rounded-full bg-white p-1 shadow-sm">
                  <ModeBtn active={mode === 'columns'} onClick={() => setMode('columns')} icon={Columns3}>Côte à côte</ModeBtn>
                  <ModeBtn active={mode === 'overlay'} onClick={() => setMode('overlay')} icon={Layers}>Superposition</ModeBtn>
                </div>
              </div>
              {ranked.length > 1 && <Podium ranked={ranked} color={color} base={base} />}
              <div className="mt-6 grid gap-5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${shown.results.length > 3 ? 270 : 300}px, 1fr))` }}>
                {shown.results.map((r, i) => <StrategyCard key={r.id} r={r} base={base} color={color(r.id)} best={best?.r.id === r.id} delay={i * 0.07} onFocus={() => setFocusId(r.id)} focused={focus?.id === r.id} />)}
              </div>
            </Chapter>

            <Chapter id="recolte" n="02" kicker="Récolte" title={<>Ce que chaque levier <em className="text-emerald-700">sauve</em></>}>
              <div className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2" title="Récolte saine par parcelle" icon={BarChart3} subtitle="Valeur exacte au sommet de chaque barre · barre hachurée = témoin sans levier">
                  <HarvestByParcelChart out={shown} parcels={parcels} strategies={strategies} height={320} />
                </Card>
                <Card title="Année après année" icon={TrendingUp} subtitle={focus ? `Stratégie : ${focus.isBaseline ? 'Témoin' : focus.name}` : ''} right={<FocusPicker results={shown.results} value={focus?.id} onChange={setFocusId} color={color} />}>
                  {focus && <YearlyHarvestChart result={focus} parcels={parcels} height={320} />}
                </Card>
              </div>
            </Chapter>

            <Chapter id="dynamique" n="03" kicker="Dynamique" title={<>La vie de la <em className="text-emerald-700">population</em></>}>
              <Card title={mode === 'overlay' ? 'Pression moyenne sur les cerisiers — toutes stratégies' : 'Femelles adultes par parcelle'} icon={Activity}
                subtitle={mode === 'overlay' ? 'Bandes rouges = périodes de sensibilité des fruits' : 'Légende cliquable · bandes = maturité des fruits · 🚜 traitement 🛡️ filet 🧺 récolte 🐝 parasitoïdes 🧬 TIS'}
                right={mode === 'columns' ? <FocusPicker results={shown.results} value={focus?.id} onChange={setFocusId} color={color} /> : undefined}>
                {mode === 'overlay'
                  ? <><OverlayChart out={shown} strategies={strategies} height={400} /><StrategyLegend results={shown.results} strategies={strategies} /></>
                  : focus && <PopulationChart out={shown} result={focus} parcels={parcels} height={420} />}
                <PhenologyNote />
              </Card>
            </Chapter>

            <Chapter id="economie" n="04" kicker="Économie" title={<>Le bilan, <em className="text-emerald-700">euro par euro</em></>} className="print-break">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Bilan économique annuel" icon={Euro} subtitle="CA sauvé vs témoin (vert) face aux coûts des leviers · ● bilan net">
                  <EconomicsChart out={shown} strategies={strategies} height={340} />
                </Card>
                <Card title="Profil multicritère" icon={RadarIcon} subtitle="0-100 : plus la surface est grande, meilleure est la stratégie">
                  <RadarScore out={shown} strategies={strategies} height={320} />
                  <StrategyLegend results={shown.results} strategies={strategies} />
                </Card>
              </div>
            </Chapter>

            <Chapter id="territoire" n="05" kicker="Territoire" title={<>Où la mouche <em className="text-emerald-700">frappe</em></>}>
              <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3" title="Carte de pression maximale" icon={MapIcon} subtitle="Pic de femelles/ha par case, échelle commune au témoin — les drosophiles survolent les zones les plus touchées" right={<FocusPicker results={shown.results} value={focus?.id} onChange={setFocusId} color={color} />}>
                  {focus && <HeatPanel focus={focus} base={base} grid={grid} />}
                </Card>
                <Card className="lg:col-span-2" title="Fruits sains au fil du temps" icon={Leaf} subtitle="% de fruits indemnes (cerisiers), pondéré par la surface">
                  <HealthyFruitChart out={shown} parcels={parcels} strategies={strategies} height={340} />
                  <StrategyLegend results={shown.results} strategies={strategies} />
                </Card>
              </div>
            </Chapter>

            <Chapter id="leviers" n="06" kicker="Décision" title={<>Leviers, coûts & <em className="text-emerald-700">conseils</em></>}>
              <div className="space-y-6">
                <Card title="Leviers retenus par stratégie" icon={Layers} subtitle="Récapitulatif complet — rien n'est tronqué">
                  <LeverTable strategies={strategies.filter(s => shown.results.some(r => r.id === s.id))} parcels={parcels} results={shown.results} haPerCell={haPerCell} />
                </Card>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Recommendations results={shown.results} base={base} parcels={parcels} />
                  <Card title="Détail des coûts & contraintes" icon={Users} subtitle="Par an, sur l'ensemble de l'exploitation">
                    <CostTable results={shown.results.filter(r => !r.isBaseline)} base={base} color={color} />
                  </Card>
                </div>
                <Hypotheses />
              </div>
            </Chapter>
          </main>

          <FinalCta />
        </>
      )}
    </div>
  );
}

// ======================================================================= Blocs
const CHAPTERS = [
  { id: 'synthese', n: '01', label: 'Synthèse' }, { id: 'recolte', n: '02', label: 'Récolte' }, { id: 'dynamique', n: '03', label: 'Dynamique' },
  { id: 'economie', n: '04', label: 'Économie' }, { id: 'territoire', n: '05', label: 'Territoire' }, { id: 'leviers', n: '06', label: 'Décision' },
];

function ChapterNav() {
  const [active, setActive] = useState('synthese');
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const els = CHAPTERS.map(c => document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }); }, { rootMargin: '-35% 0px -60% 0px' });
    els.forEach(e => obs.observe(e));
    const onScroll = () => { const h = document.documentElement; setProgress(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { obs.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);
  return (
    <nav className="no-print sticky top-16 z-30 border-b border-slate-200/70 bg-[#F6F4EE]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-4 py-2 md:px-8">
        {CHAPTERS.map(c => (
          <a key={c.id} href={`#${c.id}`} className={cn('group flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all', active === c.id ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-white hover:text-slate-900')}>
            <span className={cn('font-display text-[13px] italic', active === c.id ? 'text-emerald-300' : 'text-slate-400')}>{c.n}</span>{c.label}
          </a>
        ))}
      </div>
      <motion.div className="h-0.5 origin-left bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" style={{ scaleX: progress }} />
    </nav>
  );
}

function Hero({ best, net, base, count, color, grid, chips, running, ms, source, settingsOpen, onToggleSettings }: {
  best?: StrategyResult; net: number; base: StrategyResult; count: number; color: string; grid: import('@/lib/engine').CellType[];
  chips: { icon: React.ElementType; label: string }[]; running: boolean; ms?: number; source?: { label: string; error?: string }; settingsOpen: boolean; onToggleSettings: () => void;
}) {
  const [view, setView] = useState<'best' | 'base'>('best');
  const max = Math.max(...Array.from(base.peakByCell), 1);
  const shownRes = view === 'best' && best ? best : base;
  const gainPts = best ? best.globalHarvest - base.globalHarvest : 0;
  return (
    <section className="no-print relative overflow-hidden bg-[#03241C] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(244,63,94,.18),transparent_50%)]" />
      <Contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
      <Grain opacity={0.12} />
      <HillsBackdrop className="absolute inset-x-0 bottom-0 h-40 w-full" />
      <FlyingFlies count={4} className="opacity-70" />

      <div className="relative mx-auto grid max-w-[1500px] items-center gap-10 px-4 pb-24 pt-10 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2">
            <Link href="/simulator" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 backdrop-blur hover:bg-white/20"><ArrowLeft className="h-3.5 w-3.5" /> Modifier le verger</Link>
            <LiveBadge running={running} ms={ms} source={source} />
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-8 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.3em] text-emerald-300">
            <Trophy className="h-4 w-4" /> {best ? (count > 1 ? `Verdict · meilleure stratégie sur ${count}` : 'Verdict de la simulation') : 'Témoin seul'}
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="font-display mt-3 text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            {best ? <em className="bg-gradient-to-r from-white via-emerald-200 to-amber-200 bg-clip-text not-italic text-transparent">{best.name}</em> : 'Ajoutez une stratégie'}
          </motion.h2>
          {best && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-5 max-w-xl text-lg leading-relaxed text-emerald-50/80">
              préserve <b className="text-white">{best.globalHarvest.toFixed(0)} %</b> de la récolte, soit <b className="text-white">{gainPts >= 0 ? '+' : ''}{gainPts.toFixed(0)} points</b> de plus que sans protection, pour un bilan net de <b className={net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fmtEur(net)}</b> par an.
            </motion.p>
          )}
          <div className="mt-8 grid grid-cols-3 gap-3">
            <HeroStat label="Récolte préservée" delay={0.4}><CountUp value={best?.globalHarvest ?? base.globalHarvest} suffix=" %" /><span className="mt-1 block text-[11px] font-medium text-emerald-100/60">témoin {base.globalHarvest.toFixed(0)} %</span></HeroStat>
            <HeroStat label="Bilan net / an" delay={0.5}><CountUp value={best ? net : 0} suffix=" €" signed /><span className="mt-1 block text-[11px] font-medium text-emerald-100/60">coût {fmtEur(best?.totalCost ?? 0)}</span></HeroStat>
            <HeroStat label="Pic de femelles" delay={0.6}><CountUp value={(best ?? base).peakDensity / 1000} decimals={1} suffix=" k" /><span className="mt-1 block text-[11px] font-medium text-emerald-100/60">témoin {(base.peakDensity / 1000).toFixed(0)} k /ha</span></HeroStat>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {chips.map(c => <span key={c.label} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-emerald-50/80 ring-1 ring-white/10"><c.icon className="h-3.5 w-3.5 text-emerald-300" />{c.label}</span>)}
            <button onClick={onToggleSettings} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-900 hover:bg-emerald-50">
              <Settings2 className="h-3.5 w-3.5" /> Réglages rapides <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', settingsOpen && 'rotate-180')} />
            </button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.94, rotateX: 18 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="relative">
          <div className="absolute inset-x-10 bottom-6 h-16 rounded-full bg-black/40 blur-2xl" />
          <IsoOrchard grid={grid} heat={shownRes.peakByCell} max={max} className="relative w-full drop-shadow-2xl" />
          <div className="absolute left-1/2 top-0 flex -translate-x-1/2 rounded-full bg-black/30 p-1 ring-1 ring-white/15 backdrop-blur">
            <button onClick={() => setView('base')} className={cn('rounded-full px-3 py-1 text-[11px] font-bold transition-all', view === 'base' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white')}>Sans protection</button>
            {best && <button onClick={() => setView('best')} className={cn('rounded-full px-3 py-1 text-[11px] font-bold transition-all', view === 'best' ? 'text-slate-900' : 'text-white/70 hover:text-white')} style={view === 'best' ? { backgroundColor: '#fff', boxShadow: `0 0 0 2px ${color}` } : undefined}>{best.name}</button>}
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/80 ring-1 ring-white/10 backdrop-blur">
            Pression maximale
            <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#FEF08A,#F97316,#BE123C)' }} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroStat({ label, children, delay }: { label: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/15 backdrop-blur-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">{label}</p>
      <p className="font-display mt-1 text-3xl font-semibold md:text-4xl">{children}</p>
    </motion.div>
  );
}

function Podium({ ranked, color, base }: { ranked: { r: StrategyResult; net: number }[]; color: (id: string) => string; base: StrategyResult }) {
  const maxAbs = Math.max(1, ...ranked.map(x => Math.abs(x.net)));
  return (
    <div className="rounded-[28px] border border-white bg-white/80 p-5 shadow-[0_30px_60px_-30px_rgba(2,44,34,.25)] backdrop-blur">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Classement par bilan net annuel</p>
      <ol className="space-y-3">
        {ranked.map(({ r, net }, i) => (
          <motion.li key={r.id} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="grid grid-cols-[48px_1fr_auto] items-center gap-4">
            <span className={cn('font-display text-4xl font-black italic leading-none', i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-700/70' : 'text-slate-300')}>{i + 1}</span>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm"><span className="font-bold text-slate-800">{r.name}</span><span className="text-[11px] text-slate-500">{r.globalHarvest.toFixed(0)} % récolte · {(r.globalHarvest - base.globalHarvest).toFixed(0)} pts vs témoin</span></div>
              <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: `linear-gradient(90deg, ${color(r.id)}88, ${color(r.id)})` }}
                  initial={{ width: 0 }} whileInView={{ width: `${Math.max(3, (Math.abs(net) / maxAbs) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </div>
            <span className={cn('font-display text-xl font-semibold tabular-nums', net >= 0 ? 'text-emerald-700' : 'text-rose-600')}><CountUp value={net} suffix=" €" signed /></span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function StrategyCard({ r, base, color, best, delay, onFocus, focused }: { r: StrategyResult; base: StrategyResult; color: string; best: boolean; delay: number; onFocus: () => void; focused: boolean }) {
  const d = r.globalHarvest - base.globalHarvest;
  const saved = r.revenue - base.revenue;
  const net = saved - r.totalCost;
  const peakDelta = Math.round((r.peakDensity / Math.max(1, base.peakDensity) - 1) * 100);
  const spark = useMemo(() => r.series.filter((_, i) => i % 3 === 0).map(p => Number(p.cherry_all) || 0), [r.series]);
  const c = r.isBaseline ? '#94A3B8' : color;
  return (
    <motion.button initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay, duration: 0.5 }} onClick={onFocus}
      whileHover={{ y: -4 }}
      className={cn('group relative overflow-hidden rounded-[28px] border bg-white p-5 text-left shadow-[0_24px_50px_-30px_rgba(15,23,42,.35)] transition-shadow', focused ? 'border-transparent ring-2' : 'border-white')}
      style={focused ? { ['--tw-ring-color' as string]: c } : undefined}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40" style={{ backgroundColor: c }} />
      {r.isBaseline && <div className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(45deg,#CBD5E1_0_6px,#94A3B8_6px_12px)]" />}
      <div className="relative mb-4 flex items-start gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: c }}>{r.isBaseline ? 'Référence' : 'Stratégie'}</p>
          <p className="font-display truncate text-xl font-semibold text-slate-900">{r.isBaseline ? 'Témoin sans protection' : r.name}</p>
        </div>
        {best && <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-2.5 py-1 text-[10px] font-black text-amber-950 shadow"><Trophy className="h-3 w-3" /> N°1</span>}
      </div>
      <div className="relative flex items-center gap-4">
        <RingGauge value={r.globalHarvest} color={c} size={96}>
          <span className="font-display text-2xl font-semibold text-slate-900"><CountUp value={r.globalHarvest} /></span>
          <span className="-mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">% récolte</span>
        </RingGauge>
        <div className="min-w-0 flex-1 space-y-2">
          <Metric label="Bilan net / an" tone={r.isBaseline ? 'neutral' : net >= 0 ? 'good' : 'bad'}>{r.isBaseline ? `CA ${fmtEur(r.revenue)}` : <CountUp value={net} suffix=" €" signed />}</Metric>
          <Metric label="vs témoin" tone={r.isBaseline ? 'neutral' : d > 0.5 ? 'good' : d < -0.5 ? 'bad' : 'neutral'}>{r.isBaseline ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(1)} pts`}</Metric>
          <Metric label="IFT chimique" tone={r.ift === 0 ? 'good' : r.ift <= 2 ? 'neutral' : 'bad'}>{r.ift.toFixed(1)}</Metric>
        </div>
      </div>
      <div className="relative mt-4 rounded-2xl bg-slate-50 p-3">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <span className="flex items-center gap-1"><Bug className="h-3 w-3" /> Pression sur cerisiers</span>
          <span>pic <b className="text-slate-800">{(r.peakDensity / 1000).toFixed(1)}k</b>/ha{!r.isBaseline && <b className={cn('ml-1', peakDelta < 0 ? 'text-emerald-600' : 'text-rose-600')}>{peakDelta > 0 ? '+' : ''}{peakDelta} %</b>}</span>
        </div>
        <Sparkline data={spark} color={c} width={300} height={38} className="w-full" />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{fmtEur(r.totalCost)} de leviers</span><span>{r.laborHours} h de travail</span></div>
      </div>
    </motion.button>
  );
}

function Metric({ label, children, tone }: { label: string; children: React.ReactNode; tone: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={cn('font-display text-base font-semibold tabular-nums', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-600' : 'text-slate-800')}>{children}</span>
    </div>
  );
}

function FinalCta() {
  return (
    <section className="no-print relative overflow-hidden bg-[#03241C] py-20 text-white">
      <Contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
      <Grain opacity={0.12} />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-emerald-300">Et maintenant ?</p>
          <h3 className="font-display mt-2 text-4xl font-semibold md:text-5xl">Affinez, comparez, <em className="text-amber-200">partagez.</em></h3>
          <p className="mt-3 max-w-lg text-emerald-50/70">Ajustez un levier dans l&apos;éditeur : tous les résultats se recalculent instantanément. Exportez une Fiche Conseil pour votre prochain tour de plaine.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/simulator" className="rounded-2xl bg-white px-6 py-4 font-bold text-slate-900 hover:bg-emerald-50">Retour à l&apos;éditeur</Link>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-2xl border border-white/30 px-6 py-4 font-bold hover:bg-white/10"><Printer className="h-5 w-5" /> Fiche Conseil PDF</button>
          <Link href="/docs/modele" className="rounded-2xl border border-white/30 px-6 py-4 font-bold hover:bg-white/10">Comprendre le modèle</Link>
        </div>
      </div>
    </section>
  );
}

function HeatPanel({ focus, base, grid }: { focus: StrategyResult; base: StrategyResult; grid: import('@/lib/engine').CellType[] }) {
  const max = Math.max(...Array.from(base.peakByCell), 1);
  return (
    <div className="grid items-center gap-4 md:grid-cols-[1fr_200px]">
      <div className="relative rounded-3xl bg-gradient-to-b from-sky-50 to-[#F3EEDF] p-2">
        <IsoOrchard grid={grid} heat={focus.peakByCell} max={max} className="w-full" />
        <span className="absolute left-4 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-800 shadow">{focus.isBaseline ? 'Témoin' : focus.name}</span>
      </div>
      <div className="space-y-3">
        <div className="rounded-2xl bg-slate-50 p-3 text-center"><MiniMap grid={grid} values={focus.peakByCell} max={max} size={168} /><p className="mt-1 text-[10px] text-slate-500">Vue de dessus</p></div>
        <div>
          <div className="h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#FEF08A,#F97316,#BE123C)' }} />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>0</span><span>{Math.round(max).toLocaleString('fr-FR')} /ha</span></div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Les zones claires montrent l&apos;effet protecteur ; le réservoir sauvage alimente les bordures.</p>
        </div>
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
        <Link href="/docs/modele" onClick={e => e.stopPropagation()} className="ml-3 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">Documentation complète →</Link>
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
      className={cn('break-inside-avoid rounded-[28px] border border-white bg-white/90 p-5 shadow-[0_30px_60px_-35px_rgba(2,44,34,.3)] backdrop-blur md:p-6', className)}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 ring-1 ring-emerald-200/60"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>{subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}</div>
        {right && <div className="no-print">{right}</div>}
      </div>
      {children}
    </motion.section>
  );
}
function ModeBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all', active ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900')}><Icon className="h-3.5 w-3.5" />{children}</button>;
}
function FocusPicker({ results, value, onChange, color }: { results: StrategyResult[]; value?: string; onChange: (id: string) => void; color: (id: string) => string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700" style={{ borderLeft: `4px solid ${value ? color(value) : '#ccc'}` }}>
      {results.map(r => <option key={r.id} value={r.id}>{r.isBaseline ? 'Témoin' : r.name}</option>)}
    </select>
  );
}
function SkeletonResults() {
  return <div className="grid gap-4 md:grid-cols-3"><div className="col-span-full flex items-center justify-center gap-3 py-6 text-sm font-semibold text-slate-500"><BuzzingFly size={40} /> Simulation des stratégies en cours…</div>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/60" />)}</div>;
}
