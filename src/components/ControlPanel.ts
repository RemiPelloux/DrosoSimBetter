import { Component, computed, input, output, signal, type Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { Calendar, Clock, Plus, Copy, Trash2, Pencil, Check, ChevronDown, Wand2, Euro, Lock, type IconNode } from 'lucide';
import { gridStore, select, parcelsSig, type Parcel } from '@/lib/store';
import { defaultLeverConfig, defaultCosts, isCherry, type LeverConfig, type CellType, type LeverCosts, type SimParams, type Economics } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { IconNet, IconHygiene, IconSpray, IconParasitoid, IconSterileMale, IconMildWinter, IconHarshWinter, IconHumidSpring, IconHeat, IconForest, IconCherry, IconClimate } from '@/components/icons';
import { Lucide } from './ui/lucide';
import { Motion } from './ui/motion';
import { AutoFocus } from './ui/autofocus';

export type LeverKey = 'prophylaxis' | 'netting' | 'treatment' | 'parasitoids' | 'tis';

export const LEVERS: { key: LeverKey; label: string; short: string; icon: Type<unknown>; color: string; targets: (t: CellType) => boolean; cost: string; note: string }[] = [
  { key: 'prophylaxis', label: 'Prophylaxie / Hygiène', short: 'Prophylaxie', icon: IconHygiene, color: '#0D9488', targets: isCherry, cost: 'Matériel faible · MO très élevée', note: 'Réduit les fruits résiduels et la population qui hiverne' },
  { key: 'netting', label: 'Filet insect-proof', short: 'Filet', icon: IconNet, color: '#2563EB', targets: isCherry, cost: 'Investissement €€€ · IFT 0', note: 'Bloque l’accès aux fruits et filtre les mouvements' },
  { key: 'treatment', label: 'Protection phyto / Biocontrôle', short: 'Traitement', icon: IconSpray, color: '#D97706', targets: isCherry, cost: 'Coût €€ · IFT élevé (chimie) · DAR', note: 'Mortalité des adultes pendant la rémanence · coût sur passages réels' },
  { key: 'parasitoids', label: 'Lâchers de parasitoïdes', short: 'Parasitoïdes', icon: IconParasitoid, color: '#7C3AED', targets: t => t === 'forest' || isCherry(t), cost: 'Effet de fond · montée en puissance A2-A3', note: 'Ganaspis / Trichopria : larves parasitées, effet cumulatif' },
  { key: 'tis', label: 'TIS (mâles stériles)', short: 'TIS', icon: IconSterileMale, color: '#DB2777', targets: isCherry, cost: 'Technologie de pointe · zéro résidu', note: 'Réduit les pontes fertiles de fin mars à mi-septembre' },
];
type Lever = (typeof LEVERS)[number];

/** Index précalculés : levier par clé et nombre de leviers applicables par type de case. */
const LEVER_BY_KEY = Object.fromEntries(LEVERS.map(l => [l.key, l])) as Record<LeverKey, Lever>;
const TARGET_COUNT: Partial<Record<CellType, number>> = {};
for (const t of ['forest', 'early-cherry', 'season-cherry', 'late-cherry'] as CellType[]) TARGET_COUNT[t] = LEVERS.filter(l => l.targets(t)).length;

const CLIMATES = [
  { id: 'mild-winter', label: 'Hiver doux', icon: IconMildWinter, desc: 'Survie hivernale élevée, pression précoce' },
  { id: 'harsh-winter', label: 'Hiver rigoureux', icon: IconHarshWinter, desc: 'Mortalité hivernale élevée' },
  { id: 'humid-spring', label: 'Printemps humide', icon: IconHumidSpring, desc: 'Ponte ↑, véraison retardée, traitements lessivés' },
  { id: 'dry-summer', label: 'Été caniculaire', icon: IconHeat, desc: 'Ponte freinée et surmortalité > 28 °C' },
] as const;

// ------------------------------------------------------------------ UI atoms
@Component({
  selector: 'ds-field',
  imports: [Lucide, NgComponentOutlet],
  host: { style: 'display: contents' },
  template: `
    <div><p class="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">@if (node(); as n) { <svg [lucide]="n" class="h-3.5 w-3.5"></svg> } @else { <ng-container *ngComponentOutlet="comp(); inputs: { className: 'h-3.5 w-3.5' }" /> } {{ label() }}</p><ng-content /></div>
  `,
})
export class Field {
  readonly label = input.required<string>();
  /** Icône Lucide (IconNode) ou composant d'icône maison. */
  readonly icon = input.required<IconNode | Type<unknown>>();
  protected node = computed(() => { const i = this.icon(); return Array.isArray(i) ? i as IconNode : null; });
  protected comp = computed(() => { const i = this.icon(); return Array.isArray(i) ? null : i as Type<unknown>; });
}

@Component({
  selector: 'ds-segmented',
  host: { style: 'display: contents' },
  template: `
    <div class="flex rounded-lg bg-slate-100 p-0.5">
      @for (o of options(); track o.v) {
        <button (click)="valueChange.emit(o.v)" [class]="cn('flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all', value() === o.v ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800')">{{ o.l }}</button>
      }
    </div>
  `,
})
export class Segmented<T extends string> {
  readonly value = input.required<T>();
  readonly options = input.required<{ v: T; l: string }[]>();
  readonly valueChange = output<T>();
  protected cn = cn;
}

@Component({
  selector: 'ds-row',
  host: { style: 'display: contents' },
  template: `<div><p class="mb-1 text-[10px] font-semibold text-slate-600">{{ label() }}</p><ng-content /></div>`,
})
class Row {
  readonly label = input.required<string>();
}

@Component({
  selector: 'ds-toggle',
  host: { style: 'display: contents' },
  template: `
    <button (click)="valueChange.emit(!value())" class="flex w-full items-center justify-between text-[11px] font-semibold text-slate-600">
      {{ label() }}
      <span [class]="cn('relative h-5 w-9 rounded-full transition-colors', value() ? 'bg-emerald-600' : 'bg-slate-300')">
        <span [class]="cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', value() ? 'left-[18px]' : 'left-0.5')"></span>
      </span>
    </button>
  `,
})
class Toggle {
  readonly label = input.required<string>();
  readonly value = input.required<boolean>();
  readonly valueChange = output<boolean>();
  protected cn = cn;
}

@Component({
  selector: 'ds-number-field',
  imports: [Lucide],
  host: { style: 'display: contents' },
  template: `
    <label class="block rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <span class="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><svg [lucide]="I.Euro" class="h-3 w-3"></svg>{{ label() }}</span>
      <span class="flex items-baseline gap-1">
        <input type="number" [value]="value()" [step]="step()" [min]="min()" [max]="max()" (input)="onInput($event)"
          class="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none" />
        <span class="text-[10px] text-slate-400">{{ unit() }}</span>
      </span>
    </label>
  `,
})
class NumberField {
  readonly label = input.required<string>();
  readonly unit = input.required<string>();
  readonly value = input.required<number>();
  readonly step = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly valueChange = output<number>();
  protected I = { Euro };
  protected onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    const clamped = Math.min(this.max(), Math.max(this.min(), v));
    this.valueChange.emit(clamped);
    // comme un champ contrôlé React : la valeur bornée s'affiche
    if (clamped !== v) el.value = String(clamped);
  }
}

@Component({
  selector: 'ds-icon-btn',
  host: { '[attr.title]': 'null', style: 'display: contents' },
  template: `<button [title]="title()" (click)="press.emit()" [class]="cn('flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold', danger() ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-white')"><ng-content /></button>`,
})
class IconBtn {
  readonly title = input.required<string>();
  readonly danger = input(false);
  readonly press = output<void>();
  protected cn = cn;
}

@Component({
  selector: 'ds-adv',
  imports: [NgComponentOutlet],
  host: { style: 'display: contents' },
  template: `
    <div class="rounded-lg border border-slate-200 bg-white p-2.5">
      <div class="mb-2 flex items-center gap-1.5 text-[11px] font-bold" [style.color]="l().color"><ng-container *ngComponentOutlet="l().icon; inputs: { className: 'h-3.5 w-3.5' }" /> {{ l().label }}<span class="ml-auto font-normal text-slate-400">{{ l().cost }}</span></div>
      <div class="space-y-2"><ng-content /></div>
    </div>
  `,
})
class Adv {
  readonly l = input.required<Lever>();
}

// ------------------------------------------------------------------ Réglages de simulation
@Component({
  selector: 'ds-simulation-settings',
  imports: [Field, Segmented, NgComponentOutlet],
  host: { style: 'display: contents' },
  template: `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <ds-field label="Début" [icon]="I.Calendar">
          <ds-segmented [value]="simParams().startSeason" (valueChange)="set({ startSeason: $event })" [options]="seasonOpts" />
        </ds-field>
        <ds-field label="Durée" [icon]="I.Clock">
          <ds-segmented [value]="'' + simParams().durationYears" (valueChange)="set({ durationYears: +$event })" [options]="durationOpts" />
        </ds-field>
      </div>
      <ds-field label="Profil climatique" [icon]="IconClimate">
        <div class="grid grid-cols-2 gap-1.5">
          @for (c of climates; track c.id) {
            @let on = simParams().climateProfile === c.id;
            <button (click)="set({ climateProfile: c.id })" [attr.data-on]="on"
              [class]="cn('ico-host press flex items-start gap-2 rounded-lg border p-2 text-left transition-all',
                on ? 'border-slate-900 bg-slate-900 text-white shadow' : 'border-slate-200 bg-white hover:border-slate-300')">
              <ng-container *ngComponentOutlet="c.icon; inputs: { className: 'mt-0.5 h-5 w-5 shrink-0' }" />
              <span><span class="block text-xs font-bold">{{ c.label }}</span><span [class]="cn('block text-[10px]', on ? 'text-slate-300' : 'text-slate-500')">{{ c.desc }}</span></span>
            </button>
          }
        </div>
      </ds-field>
    </div>
  `,
})
export class SimulationSettings {
  protected I = { Calendar, Clock };
  protected IconClimate = IconClimate;
  protected cn = cn;
  protected climates = CLIMATES;
  protected simParams = select(s => s.simParams);
  protected seasonOpts: { v: SimParams['startSeason']; l: string }[] = [{ v: 'spring', l: 'Printemps' }, { v: 'autumn', l: 'Automne' }];
  protected durationOpts = [{ v: '1', l: '1 an' }, { v: '2', l: '2 ans' }, { v: '3', l: '3 ans' }];
  protected set(p: Partial<SimParams>) { gridStore.getState().setSimParams(p); }
}

// ------------------------------------------------------------------ Réglages économiques
@Component({
  selector: 'ds-economics-settings',
  imports: [Lucide, NumberField],
  host: { style: 'display: contents' },
  template: `
    <div class="space-y-2">
      <div class="grid grid-cols-3 gap-2">
        <ds-number-field label="Rendement" unit="t/ha" [value]="eco().yieldTPerHa" [step]="0.5" [min]="1" [max]="30" (valueChange)="set({ yieldTPerHa: $event })" />
        <ds-number-field label="Prix" unit="€/kg" [value]="eco().pricePerKg" [step]="0.1" [min]="0.5" [max]="15" (valueChange)="set({ pricePerKg: $event })" />
        <ds-number-field label="1 case" unit="m²" [value]="eco().cellAreaM2" [step]="25" [min]="25" [max]="2500" (valueChange)="set({ cellAreaM2: $event })" />
      </div>
      <button (click)="open.set(!open())" class="flex w-full items-center justify-between rounded-lg px-1 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900">
        <span>Coûts des leviers @if (isDefault()) { <span class="font-normal text-slate-400">(valeurs indicatives)</span> } @else { <span class="font-normal text-amber-600">(personnalisés)</span> }</span>
        <svg [lucide]="I.ChevronDown" [class]="cn('h-3.5 w-3.5 transition-transform', open() && 'rotate-180')"></svg>
      </button>
      @if (open()) {
        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            @for (f of fields; track f[0]) { <ds-number-field [label]="f[1]" [unit]="f[2]" [value]="costs()[f[0]]" [step]="f[3]" [min]="0" [max]="20000" (valueChange)="setCost(f[0], $event)" /> }
          </div>
          @if (!isDefault()) { <button (click)="set({ costs: defaults() })" class="text-[11px] font-semibold text-slate-500 underline hover:text-slate-800">Rétablir les valeurs par défaut</button> }
          <p class="text-[10px] text-slate-400">Toute la main-d’œuvre (pose des filets 40 h/ha, passages 1,5 h/ha, prophylaxie) est valorisée au taux horaire.</p>
        </div>
      }
    </div>
  `,
})
export class EconomicsSettings {
  protected I = { ChevronDown };
  protected cn = cn;
  protected eco = select(s => s.economics);
  protected open = signal(false);
  protected costs = computed(() => ({ ...defaultCosts, ...(this.eco().costs ?? {}) }));
  protected isDefault = computed(() => { const c = this.costs(); return (Object.keys(defaultCosts) as (keyof LeverCosts)[]).every(k => c[k] === defaultCosts[k]); });
  protected fields: [keyof LeverCosts, string, string, number][] = [
    ['netMonorang', 'Filet monorang', '€/ha/an', 50], ['netMonoparcelle', 'Filet monoparcelle', '€/ha/an', 50], ['laborHour', 'Main-d’œuvre', '€/h', 0.5],
    ['phytoConv', 'Phyto conventionnel', '€/passage/ha', 5], ['phytoBio', 'Biocontrôle', '€/passage/ha', 5], ['tis', 'TIS', '€/ha', 25],
    ['parasitoidStd', 'Parasitoïdes standard', '€/ha', 10], ['parasitoidReinf', 'Parasitoïdes renforcé', '€/ha', 10],
  ];
  protected defaults() { return { ...defaultCosts }; }
  protected set(e: Partial<Economics>) { gridStore.getState().setEconomics(e); }
  protected setCost(k: keyof LeverCosts, v: number) { this.set({ costs: { ...this.costs(), [k]: v } }); }
}

// ------------------------------------------------------------------ Barre des stratégies
@Component({
  selector: 'ds-strategy-bar',
  imports: [Lucide, IconBtn, AutoFocus],
  host: { style: 'display: contents' },
  template: `
    <div class="space-y-2">
      <div class="flex flex-wrap gap-1.5">
        @for (s of strategies(); track s.id) {
          <button (click)="store.setActiveStrategy(s.id)"
            [class]="cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
              s.id === activeId() ? 'border-slate-900 bg-slate-900 text-white shadow' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')">
            <span class="h-2.5 w-2.5 rounded-full" [style.background-color]="s.color"></span>
            @if (s.isBaseline) { <svg [lucide]="I.Lock" class="h-3 w-3"></svg> Témoin } @else { {{ s.name }} }
          </button>
        }
        <button (click)="store.addStrategy()" class="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-500 hover:text-slate-800">
          <svg [lucide]="I.Plus" class="h-3 w-3"></svg> Ajouter une stratégie
        </button>
      </div>
      @if (active(); as a) {
        <div class="flex items-center gap-1.5 rounded-lg bg-slate-50 p-1.5">
          @if (editing() === a.id) {
            <form class="flex flex-1 gap-1" (submit)="$event.preventDefault(); store.renameStrategy(a.id, draft().trim() || a.name); editing.set(null)">
              <input autoFocus [value]="draft()" (input)="draft.set($any($event.target).value)" class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <button class="rounded-md bg-slate-900 px-2 text-white"><svg [lucide]="I.Check" class="h-3.5 w-3.5"></svg></button>
            </form>
          } @else {
            <span class="flex-1 truncate px-1 text-xs font-bold text-slate-800">{{ a.name }}</span>
          }
          @if (!a.isBaseline && editing() !== a.id) { <ds-icon-btn title="Renommer" (press)="editing.set(a.id); draft.set(a.name)"><svg [lucide]="I.Pencil" class="h-3.5 w-3.5"></svg> Renommer</ds-icon-btn> }
          <ds-icon-btn title="Dupliquer" (press)="store.duplicateStrategy(a.id)"><svg [lucide]="I.Copy" class="h-3.5 w-3.5"></svg> Dupliquer</ds-icon-btn>
          @if (!a.isBaseline) { <ds-icon-btn title="Supprimer" [danger]="true" (press)="store.removeStrategy(a.id)"><svg [lucide]="I.Trash2" class="h-3.5 w-3.5"></svg> Supprimer</ds-icon-btn> }
        </div>
      }
    </div>
  `,
})
export class StrategyBar {
  protected I = { Lock, Plus, Check, Pencil, Copy, Trash2 };
  protected cn = cn;
  protected store = gridStore.getState();
  protected strategies = select(s => s.strategies);
  protected activeId = select(s => s.activeStrategyId);
  protected active = computed(() => this.strategies().find(s => s.id === this.activeId()));
  protected editing = signal<string | null>(null);
  protected draft = signal('');
}

// ------------------------------------------------------------------ Réglages avancés d'une parcelle
@Component({
  selector: 'ds-advanced-levers',
  imports: [Adv, Row, Toggle, Segmented],
  host: { style: 'display: contents' },
  template: `
    @if (!activeLevers().length) {
      <p class="border-t border-slate-100 bg-slate-50 px-3 py-3 text-[11px] italic text-slate-500">Activez un levier pour accéder à ses réglages avancés.</p>
    } @else {
      <div class="space-y-3 border-t border-slate-100 bg-slate-50/70 px-3 py-3">
        @if (cherry() && lv().prophylaxis) {
          <ds-adv [l]="levers[0]">
            <ds-row [label]="'Taux de récolte : ' + lv().harvestRate + ' %'">
              <input type="range" [min]="80" [max]="99" [value]="lv().harvestRate" (input)="leverChange.emit({ harvestRate: +$any($event.target).value })" class="w-full accent-teal-600" />
              <div class="flex justify-between text-[9px] text-slate-400"><span>Standard 80 %</span><span>Sanitaire 98 %</span></div>
            </ds-row>
            <ds-toggle label="Destruction des fruits tombés au sol" [value]="lv().groundFruitDestruction" (valueChange)="leverChange.emit({ groundFruitDestruction: $event })" />
          </ds-adv>
        }
        @if (cherry() && lv().netting) {
          <ds-adv [l]="levers[1]">
            <ds-row label="Type"><ds-segmented [value]="lv().netType" (valueChange)="leverChange.emit({ netType: $event })" [options]="o.netType" /></ds-row>
            <ds-row label="Déploiement"><ds-segmented [value]="lv().netDeploy" (valueChange)="leverChange.emit({ netDeploy: $event })" [options]="o.netDeploy" /></ds-row>
          </ds-adv>
        }
        @if (cherry() && lv().treatment) {
          <ds-adv [l]="levers[2]">
            <ds-row label="Mode"><ds-segmented [value]="lv().treatmentMode" (valueChange)="leverChange.emit({ treatmentMode: $event })" [options]="o.treatmentMode" /></ds-row>
            <ds-row label="Nombre de passages"><ds-segmented [value]="'' + lv().treatmentPasses" (valueChange)="leverChange.emit({ treatmentPasses: +$event })" [options]="o.passes" /></ds-row>
            <ds-row label="Déclenchement"><ds-segmented [value]="lv().treatmentTrigger" (valueChange)="leverChange.emit({ treatmentTrigger: $event })" [options]="o.trigger" /></ds-row>
            <p class="text-[10px] text-slate-500">{{ lv().treatmentMode === 'conventional' ? 'Spinosad / Exirel — rémanence 7 j, comptabilisé dans l’IFT.' : 'Argile / huiles — rémanence 4 j, hors IFT chimique.' }} DAR respecté (arrêt 3 j avant récolte).</p>
          </ds-adv>
        }
        @if (lv().parasitoids) {
          <ds-adv [l]="levers[3]">
            <ds-row label="Période de lâcher"><ds-segmented [value]="lv().parasitoidSeason" (valueChange)="leverChange.emit({ parasitoidSeason: $event })" [options]="o.season" /></ds-row>
            <ds-row label="Intensité"><ds-segmented [value]="lv().parasitoidDose" (valueChange)="leverChange.emit({ parasitoidDose: $event })" [options]="o.dose" /></ds-row>
          </ds-adv>
        }
        @if (cherry() && lv().tis) {
          <ds-adv [l]="levers[4]">
            <ds-row [label]="'Ratio stériles / sauvages : ' + lv().tisRatio + ':1'">
              <input type="range" [min]="2" [max]="20" [value]="lv().tisRatio" (input)="leverChange.emit({ tisRatio: +$any($event.target).value })" class="w-full accent-pink-600" />
            </ds-row>
            <p class="text-[10px] text-slate-500">Lâchers hebdomadaires de mars à septembre.</p>
          </ds-adv>
        }
      </div>
    }
  `,
})
class AdvancedLevers {
  readonly parcel = input.required<Parcel>();
  readonly lv = input.required<LeverConfig>();
  readonly leverChange = output<Partial<LeverConfig>>();
  protected levers = LEVERS;
  protected cherry = computed(() => isCherry(this.parcel().type));
  protected activeLevers = computed(() => { const lv = this.lv(), t = this.parcel().type; return LEVERS.filter(l => lv[l.key] && l.targets(t)); });
  protected o = {
    netType: [{ v: 'monorang', l: 'Monorang (95 %)' }, { v: 'monoparcelle', l: 'Monoparcelle (85 %)' }] as { v: LeverConfig['netType']; l: string }[],
    netDeploy: [{ v: 'bloom', l: 'Fin floraison' }, { v: 'veraison', l: 'Véraison' }] as { v: LeverConfig['netDeploy']; l: string }[],
    treatmentMode: [{ v: 'conventional', l: 'Conventionnel' }, { v: 'biocontrol', l: 'Biocontrôle' }] as { v: LeverConfig['treatmentMode']; l: string }[],
    passes: ['1', '2', '3', '4'].map(v => ({ v, l: v })),
    trigger: [{ v: 'calendar', l: 'Calendaire' }, { v: 'threshold', l: 'Seuil piégeage' }] as { v: LeverConfig['treatmentTrigger']; l: string }[],
    season: [{ v: 'spring', l: 'Printemps' }, { v: 'autumn', l: 'Automne' }] as { v: LeverConfig['parasitoidSeason']; l: string }[],
    dose: [{ v: 'standard', l: 'Dose standard' }, { v: 'reinforced', l: 'Dose renforcée' }] as { v: LeverConfig['parasitoidDose']; l: string }[],
  };
}

// ------------------------------------------------------------------ Matrice des leviers
@Component({
  selector: 'ds-lever-matrix',
  imports: [Lucide, Motion, NgComponentOutlet, AdvancedLevers, IconForest, IconCherry],
  host: { style: 'display: contents' },
  template: `
    @if (active(); as a) {
      @if (a.isBaseline) {
        <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <svg [lucide]="I.Lock" class="mb-2 h-8 w-8 text-slate-300"></svg>
          <p class="text-sm font-bold text-slate-700">Témoin sans protection</p>
          <p class="mt-1 max-w-xs text-xs text-slate-500">Toujours calculé en filigrane pour mesurer ce qu'il se passe si l'on ne fait rien. Sélectionnez ou créez une stratégie pour activer des leviers.</p>
        </div>
      } @else if (parcels().length === 0) {
        <p class="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs italic text-slate-400">Dessinez des parcelles pour configurer les leviers.</p>
      } @else {
        <div class="space-y-3">
          <!-- Appliquer à toutes les parcelles -->
          <div class="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
            <p class="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800"><svg [lucide]="I.Wand2" class="h-3.5 w-3.5"></svg> Appliquer à toutes les parcelles</p>
            <div class="flex flex-wrap gap-1.5">
              @for (l of levers; track l.key) {
                @let on = allOn()[l.key];
                <button (click)="applyAll(l, on)" [attr.data-on]="on"
                  [class]="cn('ico-host press flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all', on ? 'border-transparent text-white shadow' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')"
                  [style.background-color]="on ? l.color : null">
                  <ng-container *ngComponentOutlet="l.icon; inputs: { className: 'h-4 w-4' }" /> {{ l.short }}
                </button>
              }
            </div>
          </div>

          @for (p of parcels(); track p.id) {
            @let lv = a.leversByParcel[p.id] ?? defaults;
            @let expanded = open() === p.id;
            <div [class]="cn('overflow-hidden rounded-xl border bg-white transition-shadow', p.id === selectedParcelId() ? 'border-slate-900 shadow-md' : 'border-slate-200')">
              <button class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50" (click)="open.set(expanded ? null : p.id); store.selectParcel(p.id)">
                <span [class]="cn('h-4 w-4 rounded', p.type === 'forest' && 'hatch')" [style.background-color]="p.color"></span>
                @if (p.type === 'forest') { <ds-icon-forest className="h-3.5 w-3.5 text-slate-400" /> } @else { <ds-icon-cherry className="h-3.5 w-3.5 text-slate-400" /> }
                <span class="flex-1 truncate text-xs font-bold text-slate-800">{{ p.name }}</span>
                <div class="flex gap-0.5">
                  @for (l of levers; track l.key) {
                    @if (lv[l.key]) { <span [title]="l.short" class="flex h-5 w-5 items-center justify-center rounded-md text-white" [style.background-color]="l.color"><ng-container *ngComponentOutlet="l.icon; inputs: { className: 'h-3.5 w-3.5' }" /></span> }
                  }
                </div>
                <span class="text-[10px] text-slate-400">{{ count(lv) }}/{{ targetCount[p.type] ?? 0 }}</span>
                <svg [lucide]="I.ChevronDown" [class]="cn('h-4 w-4 text-slate-400 transition-transform', expanded && 'rotate-180')"></svg>
              </button>
              <div class="grid grid-cols-5 gap-1 border-t border-slate-100 px-2 py-2">
                @for (l of levers; track l.key) {
                  @let allowed = l.targets(p.type);
                  @let on = !!lv[l.key];
                  <button [disabled]="!allowed" (click)="toggle(p.id, l, on)" [attr.data-on]="on"
                    [title]="allowed ? l.label + ' — ' + l.note : 'Non applicable à ce type de parcelle'"
                    [class]="cn('ico-host press flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-all',
                      !allowed && 'cursor-not-allowed border-transparent bg-slate-50 text-slate-300',
                      allowed && !on && 'border-slate-200 text-slate-600 hover:border-slate-400',
                      on && 'lever-pop border-transparent text-white shadow')"
                    [style.background-color]="on ? l.color : null">
                    <ng-container *ngComponentOutlet="l.icon; inputs: { className: 'h-5 w-5' }" /> {{ l.short }}
                  </button>
                }
              </div>
              @if (expanded) {
                <div motion [initial]="{ height: 0 }" [animate]="{ height: 'auto' }" [exit]="{ height: 0 }" class="overflow-hidden">
                  <ds-advanced-levers [parcel]="p" [lv]="lv" (leverChange)="store.updateLever(p.id, $event)" />
                </div>
              }
            </div>
          }
        </div>
      }
    }
  `,
})
export class LeverMatrix {
  protected I = { Lock, Wand2, ChevronDown };
  protected cn = cn;
  protected levers = LEVERS;
  protected defaults = defaultLeverConfig;
  protected targetCount = TARGET_COUNT;
  protected store = gridStore.getState();
  protected strategies = select(s => s.strategies);
  protected activeId = select(s => s.activeStrategyId);
  protected selectedParcelId = select(s => s.selectedParcelId);
  protected parcels = parcelsSig;
  protected active = computed(() => this.strategies().find(s => s.id === this.activeId()));
  protected open = signal<string | null>(null);

  protected allOn = computed(() => {
    const a = this.active(), parcels = this.parcels();
    const out = {} as Record<LeverKey, boolean>;
    for (const k of Object.keys(LEVER_BY_KEY) as LeverKey[]) {
      const lever = LEVER_BY_KEY[k];
      out[k] = !!a && parcels.filter(p => lever.targets(p.type)).every(p => a.leversByParcel[p.id]?.[k]);
    }
    return out;
  });

  protected count(lv: LeverConfig) { return LEVERS.filter(l => lv[l.key]).length; }
  protected applyAll(l: Lever, on: boolean) { this.store.applyLeverToAll({ [l.key]: !on } as Partial<LeverConfig>, l.key === 'parasitoids' ? 'all' : 'cherry'); }
  protected toggle(parcelId: string, l: Lever, on: boolean) { this.store.updateLever(parcelId, { [l.key]: !on } as Partial<LeverConfig>); }
}
