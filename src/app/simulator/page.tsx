'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AppHeader, LiveBadge, useShareHydration } from '@/components/AppHeader';
import { GridEditor } from '@/components/GridEditor';
import { SimulationSettings, StrategyBar, LeverMatrix, EconomicsSettings } from '@/components/ControlPanel';
import { PopulationChart, HarvestByParcelChart, fmtEur, THRESHOLD } from '@/components/charts';
import { useGridStore } from '@/lib/store';
import { FlyingFlies, Drosophila } from '@/components/illustrations';
import { useSimulation } from '@/lib/useSimulation';
import { cn } from '@/lib/utils';
import { ArrowRight, Zap, Minimize2, PanelLeft, Columns3, PanelRight, GripVertical, ChevronDown, Euro, Map, SlidersHorizontal, Activity, X, Paintbrush, Wand2, BarChart3 } from 'lucide-react';

export default function SimulatorPage() {
  useShareHydration();
  const strategies = useGridStore(s => s.strategies);
  const activeId = useGridStore(s => s.activeStrategyId);
  const onboardingDone = useGridStore(s => s.onboardingDone);
  const layout = useGridStore(s => s.layout);
  const setLayout = useGridStore(s => s.setLayout);
  const fullscreen = useGridStore(s => s.editorFullscreen);
  const mainRef = useRef<HTMLElement>(null);
  const startDrag = (which: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = mainRef.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const [l, c] = useGridStore.getState().layout;
      if (which === 0) { const nl = Math.min(54, Math.max(22, pct)); setLayout([nl, Math.max(24, Math.min(c, 100 - nl - 22))]); }
      else setLayout([l, Math.min(100 - l - 22, Math.max(24, pct - l))]);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const { out, running, parcels, source } = useSimulation();
  const [showEco, setShowEco] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'levers' | 'live'>('map');

  const active = out?.results.find(r => r.id === activeId);
  const activeColor = strategies.find(s => s.id === activeId)?.color; // calculé une fois par rendu, hors JSX
  const base = out?.results.find(r => r.isBaseline);
  const haTotal = parcels.reduce((a, p) => a + p.area, 0) * useGridStore.getState().economics.cellAreaM2 / 10000;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title="Verger & leviers" subtitle={`${parcels.length} parcelles · ${haTotal.toFixed(2)} ha · ${strategies.length} stratégies`} step={1} />

      {/* Onglets mobile */}
      <div className="sticky top-16 z-30 flex gap-1 border-b border-slate-200 bg-white p-1.5 lg:hidden">
        {([['map', 'Verger', Map], ['levers', 'Leviers', SlidersHorizontal], ['live', 'Aperçu', Activity]] as const).map(([id, l, I]) => (
          <button key={id} onClick={() => setMobileTab(id)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold', mobileTab === id ? 'bg-slate-900 text-white' : 'text-slate-600')}><I className="h-4 w-4" />{l}</button>
        ))}
      </div>

      {/* Préréglages de mise en page */}
      <div className="no-print mx-auto hidden max-w-[1920px] items-center justify-end gap-1 px-4 pt-3 lg:flex">
        <span className="mr-1 text-[11px] font-semibold text-slate-400">Disposition</span>
        {([['Éditeur large', [52, 25], PanelLeft], ['Équilibrée', [32, 36], Columns3], ['Leviers large', [26, 46], PanelRight]] as const).map(([l, v, I]) => (
          <button key={l} onClick={() => setLayout([v[0], v[1]])} className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold', Math.abs(layout[0] - v[0]) < 1 && Math.abs(layout[1] - v[1]) < 1 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white')}><I className="h-3.5 w-3.5" />{l}</button>
        ))}
      </div>
      <main ref={mainRef} className="mx-auto flex max-w-[1920px] flex-col gap-4 p-4 lg:flex-row lg:gap-0" style={{ ['--l' as string]: `${layout[0]}%`, ['--c' as string]: `${layout[1]}%` }}>
        {/* Colonne gauche : éditeur */}
        <motion.section initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className={cn('min-w-0 space-y-3 lg:w-[var(--l)] lg:shrink-0', mobileTab !== 'map' && 'hidden lg:block')}>
          <Panel title="Éditeur parcellaire" icon={Paintbrush}><GridEditor /></Panel>
        </motion.section>

        <ResizeHandle onPointerDown={startDrag(0)} onReset={() => setLayout([32, 36])} />

        {/* Colonne centrale : contrôles en haut, leviers en bas */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={cn('min-w-0 space-y-3 lg:w-[var(--c)] lg:shrink-0', mobileTab !== 'levers' && 'hidden lg:block')}>
          <Panel title="Simulation" icon={Zap} right={<LiveBadge running={running} ms={out?.computeMs} source={source} />}>
            <SimulationSettings />
            <button onClick={() => setShowEco(v => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100">
              <span className="flex items-center gap-1.5"><Euro className="h-3.5 w-3.5" /> Hypothèses économiques</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showEco && 'rotate-180')} />
            </button>
            <AnimatePresence>{showEco && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-2"><EconomicsSettings /></motion.div>}</AnimatePresence>
          </Panel>
          <Panel title="Stratégies & leviers par parcelle" icon={SlidersHorizontal}>
            <StrategyBar />
            <div className="mt-3"><LeverMatrix /></div>
          </Panel>
        </motion.section>

        <ResizeHandle onPointerDown={startDrag(1)} onReset={() => setLayout([32, 36])} />

        {/* Colonne droite : aperçu temps réel */}
        <motion.section initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className={cn('min-w-0 flex-1 space-y-3', mobileTab !== 'live' && 'hidden lg:block')}>
          <div className="lg:sticky lg:top-20 space-y-3">
            <Panel title="Aperçu temps réel" icon={Activity} right={<LiveBadge running={running} ms={out?.computeMs} source={source} />}>
              {!out || parcels.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-xs text-slate-400">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}><Drosophila size={56} /></motion.div>Dessinez un verger (ou choisissez un modèle) : les résultats apparaissent instantanément ici.
                </div>
              ) : active && base ? (
                <>
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeColor }} />
                    <b className="truncate text-slate-800">{active.isBaseline ? 'Témoin sans protection' : active.name}</b>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniKpi label="Récolte préservée" value={`${active.globalHarvest.toFixed(0)} %`} delta={active.isBaseline ? undefined : active.globalHarvest - base.globalHarvest} unit="pts" />
                    <MiniKpi label="Bilan vs témoin" value={fmtEur(active.revenue - base.revenue - active.totalCost)} tone={active.revenue - base.revenue - active.totalCost >= 0 ? 'good' : 'bad'} />
                    <MiniKpi label="Pic femelles/ha" value={active.peakDensity.toLocaleString('fr-FR')} tone={active.peakDensity > THRESHOLD ? 'bad' : 'good'} />
                    <MiniKpi label="IFT chimique" value={active.ift.toFixed(1)} tone={active.ift > 2 ? 'bad' : 'good'} />
                  </div>
                  <div className="mt-3"><PopulationChart out={out} result={active} parcels={parcels} height={190} compact /></div>
                  <div className="mt-2"><HarvestByParcelChart out={out} parcels={parcels} strategies={strategies} height={170} /></div>
                </>
              ) : null}
              <Link href="/results" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-transform hover:-translate-y-0.5 hover:bg-emerald-800">
                Voir l&apos;analyse complète <ArrowRight className="h-4 w-4" />
              </Link>
            </Panel>
          </div>
        </motion.section>
      </main>

      <AnimatePresence>
        {fullscreen && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-50">
            <div className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
              <Paintbrush className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-extrabold text-slate-900">Éditeur parcellaire — plein écran</span>
              <span className="hidden text-[11px] text-slate-400 md:inline">Échap ou Maj+F pour quitter · [ ] taille du pinceau · 1-4 types · B R F E V outils</span>
              <span className="ml-auto"><LiveBadge running={running} ms={out?.computeMs} source={source} /></span>
              <button onClick={() => useGridStore.getState().setEditorFullscreen(false)} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"><Minimize2 className="h-4 w-4" /> Réduire</button>
            </div>
            <div className="flex min-h-0 flex-1 gap-4 overflow-auto p-4">
              <div className="min-w-0 flex-1"><GridEditor variant="fullscreen" /></div>
              <aside className="hidden w-[380px] shrink-0 space-y-3 overflow-y-auto xl:block">
                {active && base && (
                  <Panel title="Impact en direct" icon={Activity}>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniKpi label="Récolte préservée" value={`${active.globalHarvest.toFixed(0)} %`} delta={active.isBaseline ? undefined : active.globalHarvest - base.globalHarvest} unit="pts" />
                      <MiniKpi label="Bilan vs témoin" value={fmtEur(active.revenue - base.revenue - active.totalCost)} tone={active.revenue - base.revenue - active.totalCost >= 0 ? 'good' : 'bad'} />
                    </div>
                    <div className="mt-2"><HarvestByParcelChart out={out!} parcels={parcels} strategies={strategies} height={170} /></div>
                  </Panel>
                )}
                <Panel title="Leviers de la stratégie active" icon={SlidersHorizontal}><StrategyBar /><div className="mt-3"><LeverMatrix /></div></Panel>
              </aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{!onboardingDone && <Onboarding />}</AnimatePresence>
    </div>
  );
}

function ResizeHandle({ onPointerDown, onReset }: { onPointerDown: (e: React.PointerEvent) => void; onReset: () => void }) {
  return (
    <div onPointerDown={onPointerDown} onDoubleClick={onReset} title="Glisser pour redimensionner · double-clic pour réinitialiser"
      className="group relative hidden w-4 shrink-0 cursor-col-resize items-start justify-center pt-24 lg:flex">
      <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-emerald-400" />
      <span className="relative z-10 flex h-10 w-3 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm group-hover:border-emerald-400 group-hover:text-emerald-600"><GripVertical className="h-3 w-3" /></span>
    </div>
  );
}

function Panel({ title, icon: Icon, children, right }: { title: string; icon: React.ElementType; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500"><Icon className="h-4 w-4" /> {title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function MiniKpi({ label, value, delta, unit, tone }: { label: string; value: string; delta?: number; unit?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      <motion.p key={value} initial={{ opacity: 0.4, y: -2 }} animate={{ opacity: 1, y: 0 }} className={cn('text-lg font-extrabold', tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900')}>{value}</motion.p>
      {delta !== undefined && <p className={cn('text-[10px] font-bold', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} {unit} vs témoin</p>}
    </div>
  );
}

const STEPS = [
  { icon: Paintbrush, title: 'Dessinez votre verger en 10 secondes', text: 'Choisissez un type (Espace Naturel, Cerise Précoce, Saison, Tardive) puis cliquez-glissez. Outil « Zone » pour un rectangle d’un geste, clic droit pour gommer. Ou partez d’un modèle.' },
  { icon: Wand2, title: 'Activez vos leviers par parcelle', text: 'Filet, prophylaxie, traitements, parasitoïdes, TIS : un clic par parcelle, ou « Appliquer à toutes ». Dépliez une parcelle pour les réglages avancés.' },
  { icon: Activity, title: 'Résultats instantanés', text: 'Chaque modification relance la simulation (quelques ms). Le témoin sans protection est toujours calculé pour comparer.' },
  { icon: BarChart3, title: 'Comparez & exportez', text: 'Créez plusieurs stratégies, comparez-les côte à côte, puis partagez un lien ou imprimez une Fiche Conseil PDF.' },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const { setOnboardingDone, loadTemplate, grid } = useGridStore.getState();
  const finish = () => { setOnboardingDone(true); if (grid.every(c => c === 'neutral')) loadTemplate('mixed'); };
  const S = STEPS[i];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button onClick={finish} className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-900">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #fbbf24 0 8px, transparent 9px), radial-gradient(circle at 70% 60%, #f43f5e 0 10px, transparent 11px), radial-gradient(circle at 45% 80%, #fff 0 4px, transparent 5px)' }} />
          <FlyingFlies count={3} />
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ scale: 0.5, opacity: 0, rotate: -15 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur"><S.icon className="h-10 w-10" /></span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Étape {i + 1} sur {STEPS.length}</p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900">{S.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{S.text}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5">{STEPS.map((_, k) => <button key={k} onClick={() => setI(k)} className={cn('h-2 rounded-full transition-all', k === i ? 'w-6 bg-emerald-700' : 'w-2 bg-slate-200')} />)}</div>
            <div className="flex gap-2">
              <button onClick={finish} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Passer</button>
              <button onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : finish())} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                {i < STEPS.length - 1 ? 'Suivant' : 'C’est parti !'} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
