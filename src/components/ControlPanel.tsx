'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGridStore, useParcels, type Parcel } from '@/lib/store';
import { defaultLeverConfig, defaultCosts, isCherry, type LeverConfig, type CellType, type LeverCosts } from '@/lib/engine';
import { cn } from '@/lib/utils';
import {
  Snowflake, Sun, CloudRain, Thermometer, Calendar, Clock, Plus, Copy, Trash2, Pencil, Check,
  ShieldCheck, SprayCan, Bug, Dna, Sprout, ChevronDown, Wand2, Euro, Lock, Trees, Cherry,
} from 'lucide-react';

export type LeverKey = 'prophylaxis' | 'netting' | 'treatment' | 'parasitoids' | 'tis';

export const LEVERS: { key: LeverKey; label: string; short: string; icon: React.ElementType; color: string; targets: (t: CellType) => boolean; cost: string; note: string }[] = [
  { key: 'prophylaxis', label: 'Prophylaxie / Hygiène', short: 'Prophylaxie', icon: Sprout, color: '#0D9488', targets: isCherry, cost: 'Matériel faible · MO très élevée', note: 'Supprime la ressource résiduelle post-récolte' },
  { key: 'netting', label: 'Filet insect-proof', short: 'Filet', icon: ShieldCheck, color: '#2563EB', targets: isCherry, cost: 'Investissement €€€ · IFT 0', note: 'Bloque l’accès aux fruits et l’immigration' },
  { key: 'treatment', label: 'Protection phyto / Biocontrôle', short: 'Traitement', icon: SprayCan, color: '#D97706', targets: isCherry, cost: 'Coût €€ · IFT élevé (chimie) · DAR', note: 'Mortalité des adultes pendant la rémanence' },
  { key: 'parasitoids', label: 'Lâchers de parasitoïdes', short: 'Parasitoïdes', icon: Bug, color: '#7C3AED', targets: t => t === 'forest' || isCherry(t), cost: 'Effet de fond · montée en puissance A2-A3', note: 'Ganaspis / Trichopria : survie larvaire réduite' },
  { key: 'tis', label: 'TIS (mâles stériles)', short: 'TIS', icon: Dna, color: '#DB2777', targets: isCherry, cost: 'Technologie de pointe · zéro résidu', note: 'Réduit la fécondité fertile de mars à sept.' },
];

/** Index précalculés : levier par clé et nombre de leviers applicables par type de case. */
const LEVER_BY_KEY = Object.fromEntries(LEVERS.map(l => [l.key, l])) as Record<LeverKey, (typeof LEVERS)[number]>;
const TARGET_COUNT: Partial<Record<CellType, number>> = {};
for (const t of ['forest', 'early-cherry', 'season-cherry', 'late-cherry'] as CellType[]) TARGET_COUNT[t] = LEVERS.filter(l => l.targets(t)).length;

const CLIMATES = [
  { id: 'mild-winter', label: 'Hiver doux', icon: Sun, desc: 'Forte survie hivernale' },
  { id: 'harsh-winter', label: 'Hiver rigoureux', icon: Snowflake, desc: 'Mortalité hivernale élevée' },
  { id: 'humid-spring', label: 'Printemps humide', icon: CloudRain, desc: 'Ponte ↑, lessivage des traitements' },
  { id: 'dry-summer', label: 'Été caniculaire', icon: Thermometer, desc: 'Ponte ralentie > 30 °C' },
] as const;

export function SimulationSettings() {
  const simParams = useGridStore(s => s.simParams);
  const setSimParams = useGridStore(s => s.setSimParams);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Début" icon={Calendar}>
          <Segmented value={simParams.startSeason} onChange={v => setSimParams({ startSeason: v })} options={[{ v: 'spring', l: 'Printemps' }, { v: 'autumn', l: 'Automne' }]} />
        </Field>
        <Field label="Durée" icon={Clock}>
          <Segmented value={String(simParams.durationYears)} onChange={v => setSimParams({ durationYears: +v })} options={[{ v: '1', l: '1 an' }, { v: '2', l: '2 ans' }, { v: '3', l: '3 ans' }]} />
        </Field>
      </div>
      <Field label="Profil climatique" icon={Thermometer}>
        <div className="grid grid-cols-2 gap-1.5">
          {CLIMATES.map(c => (
            <button key={c.id} onClick={() => setSimParams({ climateProfile: c.id })}
              className={cn('flex items-start gap-2 rounded-lg border p-2 text-left transition-all',
                simParams.climateProfile === c.id ? 'border-slate-900 bg-slate-900 text-white shadow' : 'border-slate-200 bg-white hover:border-slate-300')}>
              <c.icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span><span className="block text-xs font-bold">{c.label}</span><span className={cn('block text-[10px]', simParams.climateProfile === c.id ? 'text-slate-300' : 'text-slate-500')}>{c.desc}</span></span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

export function EconomicsSettings() {
  const eco = useGridStore(s => s.economics);
  const set = useGridStore(s => s.setEconomics);
  const [open, setOpen] = useState(false);
  const costs = { ...defaultCosts, ...(eco.costs ?? {}) };
  const setCost = (k: keyof LeverCosts, v: number) => set({ costs: { ...costs, [k]: v } });
  const isDefault = (Object.keys(defaultCosts) as (keyof LeverCosts)[]).every(k => costs[k] === defaultCosts[k]);
  const F: [keyof LeverCosts, string, string, number][] = [
    ['netMonorang', 'Filet monorang', '€/ha/an', 50], ['netMonoparcelle', 'Filet monoparcelle', '€/ha/an', 50], ['laborHour', 'Main-d’œuvre', '€/h', 0.5],
    ['phytoConv', 'Phyto conventionnel', '€/passage/ha', 5], ['phytoBio', 'Biocontrôle', '€/passage/ha', 5], ['tis', 'TIS', '€/ha', 25],
    ['parasitoidStd', 'Parasitoïdes standard', '€/ha', 10], ['parasitoidReinf', 'Parasitoïdes renforcé', '€/ha', 10],
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Rendement" unit="t/ha" value={eco.yieldTPerHa} step={0.5} min={1} max={30} onChange={v => set({ yieldTPerHa: v })} />
        <NumberField label="Prix" unit="€/kg" value={eco.pricePerKg} step={0.1} min={0.5} max={15} onChange={v => set({ pricePerKg: v })} />
        <NumberField label="1 case" unit="m²" value={eco.cellAreaM2} step={25} min={25} max={2500} onChange={v => set({ cellAreaM2: v })} />
      </div>
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900">
        <span>Coûts des leviers {isDefault ? <span className="font-normal text-slate-400">(valeurs indicatives)</span> : <span className="font-normal text-amber-600">(personnalisés)</span>}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {F.map(([k, l, u, st]) => <NumberField key={k} label={l} unit={u} value={costs[k]} step={st} min={0} max={20000} onChange={v => setCost(k, v)} />)}
          </div>
          {!isDefault && <button onClick={() => set({ costs: { ...defaultCosts } })} className="text-[11px] font-semibold text-slate-500 underline hover:text-slate-800">Rétablir les valeurs par défaut</button>}
          <p className="text-[10px] text-slate-400">Toute la main-d’œuvre (pose des filets 40 h/ha, passages 1,5 h/ha, prophylaxie) est valorisée au taux horaire.</p>
        </div>
      )}
    </div>
  );
}

export function StrategyBar() {
  const strategies = useGridStore(s => s.strategies);
  const activeId = useGridStore(s => s.activeStrategyId);
  const { setActiveStrategy, addStrategy, duplicateStrategy, removeStrategy, renameStrategy } = useGridStore.getState();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const active = strategies.find(s => s.id === activeId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {strategies.map(s => (
          <button key={s.id} onClick={() => setActiveStrategy(s.id)}
            className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
              s.id === activeId ? 'border-slate-900 bg-slate-900 text-white shadow' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.isBaseline ? <><Lock className="h-3 w-3" /> Témoin</> : s.name}
          </button>
        ))}
        <button onClick={() => addStrategy()} className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-500 hover:text-slate-800">
          <Plus className="h-3 w-3" /> Ajouter une stratégie
        </button>
      </div>
      {active && (
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-1.5">
          {editing === active.id ? (
            <form className="flex flex-1 gap-1" onSubmit={e => { e.preventDefault(); renameStrategy(active.id, draft.trim() || active.name); setEditing(null); }}>
              <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <button className="rounded-md bg-slate-900 px-2 text-white"><Check className="h-3.5 w-3.5" /></button>
            </form>
          ) : (
            <span className="flex-1 truncate px-1 text-xs font-bold text-slate-800">{active.name}</span>
          )}
          {!active.isBaseline && editing !== active.id && <IconBtn title="Renommer" onClick={() => { setEditing(active.id); setDraft(active.name); }}><Pencil className="h-3.5 w-3.5" /> Renommer</IconBtn>}
          <IconBtn title="Dupliquer" onClick={() => duplicateStrategy(active.id)}><Copy className="h-3.5 w-3.5" /> Dupliquer</IconBtn>
          {!active.isBaseline && <IconBtn title="Supprimer" danger onClick={() => removeStrategy(active.id)}><Trash2 className="h-3.5 w-3.5" /> Supprimer</IconBtn>}
        </div>
      )}
    </div>
  );
}

export function LeverMatrix() {
  const strategies = useGridStore(s => s.strategies);
  const activeId = useGridStore(s => s.activeStrategyId);
  const selectedParcelId = useGridStore(s => s.selectedParcelId);
  const { updateLever, applyLeverToAll, selectParcel } = useGridStore.getState();
  const parcels = useParcels();
  const active = strategies.find(s => s.id === activeId);
  const [open, setOpen] = useState<string | null>(null);

  if (!active) return null;
  if (active.isBaseline) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <Lock className="mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm font-bold text-slate-700">Témoin sans protection</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">Toujours calculé en filigrane pour mesurer ce qu&apos;il se passe si l&apos;on ne fait rien. Sélectionnez ou créez une stratégie pour activer des leviers.</p>
      </div>
    );
  }
  if (parcels.length === 0) return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs italic text-slate-400">Dessinez des parcelles pour configurer les leviers.</p>;

  const allOn = (k: LeverKey) => { const lever = LEVER_BY_KEY[k]; return parcels.filter(p => lever.targets(p.type)).every(p => active.leversByParcel[p.id]?.[k]); };

  return (
    <div className="space-y-3">
      {/* Appliquer à toutes les parcelles */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800"><Wand2 className="h-3.5 w-3.5" /> Appliquer à toutes les parcelles</p>
        <div className="flex flex-wrap gap-1.5">
          {LEVERS.map(l => {
            const on = allOn(l.key);
            return (
              <button key={l.key} onClick={() => applyLeverToAll({ [l.key]: !on } as Partial<LeverConfig>, l.key === 'parasitoids' ? 'all' : 'cherry')}
                className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all', on ? 'border-transparent text-white shadow' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')}
                style={on ? { backgroundColor: l.color } : undefined}>
                <l.icon className="h-3.5 w-3.5" /> {l.short}
              </button>
            );
          })}
        </div>
      </div>

      {parcels.map(p => {
        const lv = active.leversByParcel[p.id] ?? defaultLeverConfig;
        const n = LEVERS.filter(l => lv[l.key]).length;
        const expanded = open === p.id;
        return (
          <div key={p.id} className={cn('overflow-hidden rounded-xl border bg-white transition-shadow', p.id === selectedParcelId ? 'border-slate-900 shadow-md' : 'border-slate-200')}>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setOpen(expanded ? null : p.id); selectParcel(p.id); }}>
              <span className={cn('h-4 w-4 rounded', p.type === 'forest' && 'hatch')} style={{ backgroundColor: p.color }} />
              {p.type === 'forest' ? <Trees className="h-3.5 w-3.5 text-slate-400" /> : <Cherry className="h-3.5 w-3.5 text-slate-400" />}
              <span className="flex-1 truncate text-xs font-bold text-slate-800">{p.name}</span>
              <div className="flex gap-0.5">
                {LEVERS.map(l => lv[l.key] ? <span key={l.key} title={l.short} className="flex h-5 w-5 items-center justify-center rounded-md text-white" style={{ backgroundColor: l.color }}><l.icon className="h-3 w-3" /></span> : null)}
              </div>
              <span className="text-[10px] text-slate-400">{n}/{TARGET_COUNT[p.type] ?? 0}</span>
              <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', expanded && 'rotate-180')} />
            </button>
            <div className="grid grid-cols-5 gap-1 border-t border-slate-100 px-2 py-2">
              {LEVERS.map(l => {
                const allowed = l.targets(p.type);
                const on = !!lv[l.key];
                return (
                  <button key={l.key} disabled={!allowed} onClick={() => updateLever(p.id, { [l.key]: !on } as Partial<LeverConfig>)}
                    title={allowed ? `${l.label} — ${l.note}` : 'Non applicable à ce type de parcelle'}
                    className={cn('flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-all',
                      !allowed && 'cursor-not-allowed border-transparent bg-slate-50 text-slate-300',
                      allowed && !on && 'border-slate-200 text-slate-600 hover:border-slate-400',
                      on && 'border-transparent text-white shadow')}
                    style={on ? { backgroundColor: l.color } : undefined}>
                    <l.icon className="h-4 w-4" /> {l.short}
                  </button>
                );
              })}
            </div>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <AdvancedLevers parcel={p} lv={lv} onChange={patch => updateLever(p.id, patch)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function AdvancedLevers({ parcel, lv, onChange }: { parcel: Parcel; lv: LeverConfig; onChange: (p: Partial<LeverConfig>) => void }) {
  const cherry = isCherry(parcel.type);
  const active = LEVERS.filter(l => lv[l.key] && l.targets(parcel.type));
  if (!active.length) return <p className="border-t border-slate-100 bg-slate-50 px-3 py-3 text-[11px] italic text-slate-500">Activez un levier pour accéder à ses réglages avancés.</p>;
  return (
    <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-3 py-3">
      {cherry && lv.prophylaxis && (
        <Adv l={LEVERS[0]}>
          <Row label={`Taux de récolte : ${lv.harvestRate} %`}>
            <input type="range" min={80} max={99} value={lv.harvestRate} onChange={e => onChange({ harvestRate: +e.target.value })} className="w-full accent-teal-600" />
            <div className="flex justify-between text-[9px] text-slate-400"><span>Standard 80 %</span><span>Sanitaire 98 %</span></div>
          </Row>
          <Toggle label="Destruction des fruits tombés au sol" value={lv.groundFruitDestruction} onChange={v => onChange({ groundFruitDestruction: v })} />
        </Adv>
      )}
      {cherry && lv.netting && (
        <Adv l={LEVERS[1]}>
          <Row label="Type"><Segmented value={lv.netType} onChange={v => onChange({ netType: v })} options={[{ v: 'monorang', l: 'Monorang (95 %)' }, { v: 'monoparcelle', l: 'Monoparcelle (85 %)' }]} /></Row>
          <Row label="Déploiement"><Segmented value={lv.netDeploy} onChange={v => onChange({ netDeploy: v })} options={[{ v: 'bloom', l: 'Fin floraison' }, { v: 'veraison', l: 'Véraison' }]} /></Row>
        </Adv>
      )}
      {cherry && lv.treatment && (
        <Adv l={LEVERS[2]}>
          <Row label="Mode"><Segmented value={lv.treatmentMode} onChange={v => onChange({ treatmentMode: v })} options={[{ v: 'conventional', l: 'Conventionnel' }, { v: 'biocontrol', l: 'Biocontrôle' }]} /></Row>
          <Row label="Nombre de passages"><Segmented value={String(lv.treatmentPasses)} onChange={v => onChange({ treatmentPasses: +v })} options={['1', '2', '3', '4'].map(v => ({ v, l: v }))} /></Row>
          <Row label="Déclenchement"><Segmented value={lv.treatmentTrigger} onChange={v => onChange({ treatmentTrigger: v })} options={[{ v: 'calendar', l: 'Calendaire' }, { v: 'threshold', l: 'Seuil piégeage' }]} /></Row>
          <p className="text-[10px] text-slate-500">{lv.treatmentMode === 'conventional' ? 'Spinosad / Exirel — rémanence 7 j, comptabilisé dans l’IFT.' : 'Argile / huiles — rémanence 4 j, hors IFT chimique.'} DAR respecté (arrêt 3 j avant récolte).</p>
        </Adv>
      )}
      {lv.parasitoids && (
        <Adv l={LEVERS[3]}>
          <Row label="Période de lâcher"><Segmented value={lv.parasitoidSeason} onChange={v => onChange({ parasitoidSeason: v })} options={[{ v: 'spring', l: 'Printemps' }, { v: 'autumn', l: 'Automne' }]} /></Row>
          <Row label="Intensité"><Segmented value={lv.parasitoidDose} onChange={v => onChange({ parasitoidDose: v })} options={[{ v: 'standard', l: 'Dose standard' }, { v: 'reinforced', l: 'Dose renforcée' }]} /></Row>
        </Adv>
      )}
      {cherry && lv.tis && (
        <Adv l={LEVERS[4]}>
          <Row label={`Ratio stériles / sauvages : ${lv.tisRatio}:1`}>
            <input type="range" min={2} max={20} value={lv.tisRatio} onChange={e => onChange({ tisRatio: +e.target.value })} className="w-full accent-pink-600" />
          </Row>
          <p className="text-[10px] text-slate-500">Lâchers hebdomadaires de mars à septembre.</p>
        </Adv>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ UI atoms
function Adv({ l, children }: { l: (typeof LEVERS)[number]; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: l.color }}><l.icon className="h-3.5 w-3.5" /> {l.label}<span className="ml-auto font-normal text-slate-400">{l.cost}</span></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1 text-[10px] font-semibold text-slate-600">{label}</p>{children}</div>;
}
export function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return <div><p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</p>{children}</div>;
}
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cn('flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all', value === o.v ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800')}>{o.l}</button>
      ))}
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between text-[11px] font-semibold text-slate-600">
      {label}
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', value ? 'bg-emerald-600' : 'bg-slate-300')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', value ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
function NumberField({ label, unit, value, onChange, step, min, max }: { label: string; unit: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number }) {
  return (
    <label className="block rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><Euro className="h-3 w-3" />{label}</span>
      <span className="flex items-baseline gap-1">
        <input type="number" value={value} step={step} min={min} max={max} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v))); }}
          className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none" />
        <span className="text-[10px] text-slate-400">{unit}</span>
      </span>
    </label>
  );
}
function IconBtn({ children, onClick, danger, title }: { children: React.ReactNode; onClick: () => void; danger?: boolean; title: string }) {
  return <button title={title} onClick={onClick} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold', danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-white')}>{children}</button>;
}
