import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowRight, Zap, Minimize2, PanelLeft, Columns3, PanelRight, GripVertical, ChevronDown, Euro, Map as MapIcon, SlidersHorizontal, Activity, X, Paintbrush, Wand2, BarChart3, type IconNode } from 'lucide';
import { AppHeader, LiveBadge, injectShareHydration } from '@/components/AppHeader';
import { GridEditor } from '@/components/GridEditor';
import { SimulationSettings, StrategyBar, LeverMatrix, EconomicsSettings } from '@/components/ControlPanel';
import { PopulationChart, HarvestByParcelChart, fmtEur, THRESHOLD } from '@/components/charts';
import { FlyingFlies, Drosophila } from '@/components/illustrations';
import { Lucide } from '@/components/ui/lucide';
import { Motion, motionAnimate } from '@/components/ui/motion';
import { gridStore, select } from '@/lib/store';
import { injectSimulation } from '@/lib/simulation';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------ Atomes
@Component({
  selector: 'ds-resize-handle',
  imports: [Lucide],
  host: { style: 'display: contents' },
  template: `
    <div (pointerdown)="down.emit($event)" (dblclick)="reset.emit()" title="Glisser pour redimensionner · double-clic pour réinitialiser"
      class="group relative hidden w-4 shrink-0 cursor-col-resize items-start justify-center pt-24 lg:flex">
      <div class="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-emerald-400"></div>
      <span class="relative z-10 flex h-10 w-3 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm group-hover:border-emerald-400 group-hover:text-emerald-600"><svg [lucide]="I.GripVertical" class="h-3 w-3"></svg></span>
    </div>
  `,
})
class ResizeHandle {
  readonly down = output<PointerEvent>();
  readonly reset = output<void>();
  protected I = { GripVertical };
}

/** Panneau titré ; contenu projeté `[right]` à droite du titre. */
@Component({
  selector: 'ds-panel',
  imports: [Lucide],
  host: { style: 'display: contents' },
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500"><svg [lucide]="icon()" class="h-4 w-4"></svg> {{ heading() }}</h2>
        <ng-content select="[right]" />
      </div>
      <ng-content />
    </div>
  `,
})
class Panel {
  readonly heading = input.required<string>();
  readonly icon = input.required<IconNode>();
}

@Component({
  selector: 'ds-mini-kpi',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <div class="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
      <p class="text-[10px] font-semibold text-slate-500">{{ label() }}</p>
      @for (v of [value()]; track v) {
        <p motion [initial]="{ opacity: 0.4, y: -2 }" [animate]="{ opacity: 1, y: 0 }" [class]="cn('text-lg font-extrabold', tone() === 'bad' ? 'text-red-600' : tone() === 'good' ? 'text-emerald-700' : 'text-slate-900')">{{ v }}</p>
      }
      @if (delta() !== undefined) {
        <p [class]="cn('text-[10px] font-bold', delta()! >= 0 ? 'text-emerald-600' : 'text-red-600')">{{ delta()! >= 0 ? '+' : '' }}{{ delta()!.toFixed(1) }} {{ unit() }} vs témoin</p>
      }
    </div>
  `,
})
class MiniKpi {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input<number>();
  readonly unit = input<string>();
  readonly tone = input<'good' | 'bad'>();
  protected cn = cn;
}

// ------------------------------------------------------------------ Visite guidée
const STEPS: { icon: IconNode; title: string; text: string }[] = [
  { icon: Paintbrush, title: 'Dessinez votre verger en 10 secondes', text: 'Choisissez un type (Espace Naturel, Cerise Précoce, Saison, Tardive) puis cliquez-glissez. Outil « Zone » pour un rectangle d’un geste, clic droit pour gommer. Ou partez d’un modèle.' },
  { icon: Wand2, title: 'Activez vos leviers par parcelle', text: 'Filet, prophylaxie, traitements, parasitoïdes, TIS : un clic par parcelle, ou « Appliquer à toutes ». Dépliez une parcelle pour les réglages avancés.' },
  { icon: Activity, title: 'Résultats instantanés', text: 'Chaque modification relance la simulation (quelques ms). Le témoin sans protection est toujours calculé pour comparer.' },
  { icon: BarChart3, title: 'Comparez & exportez', text: 'Créez plusieurs stratégies, comparez-les côte à côte, puis partagez un lien ou imprimez une Fiche Conseil PDF.' },
];

const ICON_SPRING = { type: 'spring', stiffness: 260, damping: 18 };

/** Visite guidée de la première visite (toujours montée ; s'affiche tant que onboardingDone est faux). */
@Component({
  selector: 'ds-onboarding',
  imports: [Lucide, Motion, FlyingFlies],
  host: { style: 'display: contents' },
  template: `
    @if (!done()) {
      <div motion [initial]="{ opacity: 0 }" [animate]="{ opacity: 1 }" [exit]="{ opacity: 0 }" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div #card class="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" motion [initial]="{ scale: 0.92, y: 20 }" [animate]="{ scale: 1, y: 0 }">
          <button (click)="finish()" aria-label="Passer la visite guidée" title="Passer" class="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><svg [lucide]="I.X" class="h-4 w-4"></svg></button>
          <div class="relative h-36 overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-900">
            <div class="absolute inset-0 opacity-30" style="background-image: radial-gradient(circle at 20% 30%, #fbbf24 0 8px, transparent 9px), radial-gradient(circle at 70% 60%, #f43f5e 0 10px, transparent 11px), radial-gradient(circle at 45% 80%, #fff 0 4px, transparent 5px)"></div>
            <ds-flying-flies [count]="3" />
            @for (k of [shown()]; track k) {
              <div #iconBox motion [initial]="{ scale: 0.5, opacity: 0, rotate: -15 }" [animate]="{ scale: 1, opacity: 1, rotate: 0 }" [transition]="spring"
                class="absolute inset-0 flex items-center justify-center">
                <span class="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur"><svg [lucide]="steps[k].icon" class="h-10 w-10"></svg></span>
              </div>
            }
          </div>
          <div class="p-6">
            @for (k of [shown()]; track k) {
              <div #textBox motion [initial]="{ opacity: 0, x: 20 }" [animate]="{ opacity: 1, x: 0 }">
                <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Étape {{ k + 1 }} sur {{ steps.length }}</p>
                <h3 class="mt-1 text-xl font-extrabold text-slate-900">{{ steps[k].title }}</h3>
                <p class="mt-2 text-sm leading-relaxed text-slate-600">{{ steps[k].text }}</p>
              </div>
            }
            <div class="mt-6 flex items-center justify-between">
              <div class="flex gap-1.5">
                @for (s of steps; track $index) {
                  <button (click)="go($index)" [attr.aria-label]="'Étape ' + ($index + 1)" [attr.aria-current]="$index === i() ? 'step' : null" [class]="cn('h-2 rounded-full transition-all', $index === i() ? 'w-6 bg-emerald-700' : 'w-2 bg-slate-200')"></button>
                }
              </div>
              <div class="flex gap-2">
                <button (click)="finish()" class="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Passer</button>
                <button (click)="next()" class="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                  {{ i() < steps.length - 1 ? 'Suivant' : 'C’est parti !' }} <svg [lucide]="I.ArrowRight" class="h-3.5 w-3.5"></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
class Onboarding {
  protected done = select(s => s.onboardingDone);
  protected i = signal(0);
  /** étape affichée : suit `i` après l'animation de sortie (AnimatePresence mode="wait") */
  protected shown = signal(0);
  protected steps = STEPS;
  protected spring = ICON_SPRING;
  protected I = { X, ArrowRight };
  protected cn = cn;
  private card = viewChild<ElementRef<HTMLElement>>('card');
  private iconBox = viewChild<ElementRef<HTMLElement>>('iconBox');
  private textBox = viewChild<ElementRef<HTMLElement>>('textBox');
  private switching = false;

  /** Changement d'étape façon AnimatePresence mode="wait" : sortie de l'étape courante, puis entrée de la suivante. */
  protected async go(k: number) {
    this.i.set(k);
    if (this.switching) return;
    this.switching = true;
    while (this.shown() !== this.i()) {
      const icon = this.iconBox()?.nativeElement, text = this.textBox()?.nativeElement;
      await Promise.all([
        icon ? motionAnimate(icon, { scale: 0.5, opacity: 0 }, ICON_SPRING) : null,
        text ? motionAnimate(text, { opacity: 0, x: -20 }) : null,
      ]);
      this.shown.set(this.i());
    }
    this.switching = false;
  }

  protected next() { if (this.i() < STEPS.length - 1) this.go(this.i() + 1); else this.finish(); }

  protected finish() {
    const { setOnboardingDone, loadTemplate, grid } = gridStore.getState();
    // sortie de la carte (l'arrière-plan s'efface via son animation de sortie)
    const c = this.card()?.nativeElement;
    if (c) motionAnimate(c, { scale: 0.95, opacity: 0 });
    setOnboardingDone(true);
    if (grid.every(x => x === 'neutral')) loadTemplate('mixed');
  }
}

// ------------------------------------------------------------------ Page
const PRESETS: [string, [number, number], IconNode][] = [['Éditeur large', [52, 25], PanelLeft], ['Équilibrée', [32, 36], Columns3], ['Leviers large', [26, 46], PanelRight]];
const TABS: ['map' | 'levers' | 'live', string, IconNode][] = [['map', 'Verger', MapIcon], ['levers', 'Leviers', SlidersHorizontal], ['live', 'Aperçu', Activity]];

@Component({
  selector: 'ds-simulator-page',
  imports: [
    RouterLink, AppHeader, LiveBadge, GridEditor, SimulationSettings, StrategyBar, LeverMatrix, EconomicsSettings,
    PopulationChart, HarvestByParcelChart, Drosophila, Lucide, Motion, ResizeHandle, Panel, MiniKpi, Onboarding,
  ],
  host: { style: 'display: contents' },
  template: `
    <div class="min-h-screen bg-slate-50">
      <ds-app-header [title]="'Verger & leviers'" [subtitle]="subtitle()" [step]="1" />

      <!-- Onglets mobile -->
      <div class="sticky top-16 z-30 flex gap-1 border-b border-slate-200 bg-white p-1.5 lg:hidden">
        @for (t of tabs; track t[0]) {
          <button (click)="mobileTab.set(t[0])" [class]="cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold', mobileTab() === t[0] ? 'bg-slate-900 text-white' : 'text-slate-600')"><svg [lucide]="t[2]" class="h-4 w-4"></svg>{{ t[1] }}</button>
        }
      </div>

      <!-- Préréglages de mise en page -->
      <div class="no-print mx-auto hidden max-w-[1920px] items-center justify-end gap-1 px-4 pt-3 lg:flex">
        <span class="mr-1 text-[11px] font-semibold text-slate-400">Disposition</span>
        @for (p of presets; track p[0]) {
          <button (click)="setLayout([p[1][0], p[1][1]])" [class]="cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold', isPreset(p[1]) ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white')"><svg [lucide]="p[2]" class="h-3.5 w-3.5"></svg>{{ p[0] }}</button>
        }
      </div>
      <main #main class="mx-auto flex max-w-[1920px] flex-col gap-4 p-4 lg:flex-row lg:gap-0" [style.--l]="layout()[0] + '%'" [style.--c]="layout()[1] + '%'">
        <!-- Colonne gauche : éditeur -->
        <section motion [initial]="{ opacity: 0, x: -16 }" [animate]="{ opacity: 1, x: 0 }" [class]="cn('min-w-0 space-y-3 lg:w-[var(--l)] lg:shrink-0', mobileTab() !== 'map' && 'hidden lg:block')">
          <ds-panel heading="Éditeur parcellaire" [icon]="I.Paintbrush"><ds-grid-editor /></ds-panel>
        </section>

        <ds-resize-handle (down)="startDrag(0, $event)" (reset)="setLayout([32, 36])" />

        <!-- Colonne centrale : contrôles en haut, leviers en bas -->
        <section motion [initial]="{ opacity: 0, y: 16 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 0.05 }" [class]="cn('min-w-0 space-y-3 lg:w-[var(--c)] lg:shrink-0', mobileTab() !== 'levers' && 'hidden lg:block')">
          <ds-panel heading="Simulation" [icon]="I.Zap">
            <ds-live-badge right [running]="running()" [ms]="out()?.computeMs" [source]="source()" />
            <ds-simulation-settings />
            <button (click)="showEco.set(!showEco())" class="mt-3 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100">
              <span class="flex items-center gap-1.5"><svg [lucide]="I.Euro" class="h-3.5 w-3.5"></svg> Hypothèses économiques</span>
              <svg [lucide]="I.ChevronDown" [class]="cn('h-4 w-4 transition-transform', showEco() && 'rotate-180')"></svg>
            </button>
            @if (showEco()) {
              <div motion [initial]="{ height: 0, opacity: 0 }" [animate]="{ height: 'auto', opacity: 1 }" [exit]="{ height: 0, opacity: 0 }" class="overflow-hidden pt-2"><ds-economics-settings /></div>
            }
          </ds-panel>
          <ds-panel heading="Stratégies & leviers par parcelle" [icon]="I.SlidersHorizontal">
            <ds-strategy-bar />
            <div class="mt-3"><ds-lever-matrix /></div>
          </ds-panel>
        </section>

        <ds-resize-handle (down)="startDrag(1, $event)" (reset)="setLayout([32, 36])" />

        <!-- Colonne droite : aperçu temps réel -->
        <section motion [initial]="{ opacity: 0, x: 16 }" [animate]="{ opacity: 1, x: 0 }" [transition]="{ delay: 0.1 }" [class]="cn('min-w-0 flex-1 space-y-3', mobileTab() !== 'live' && 'hidden lg:block')">
          <div class="lg:sticky lg:top-20 space-y-3">
            <ds-panel heading="Aperçu temps réel" [icon]="I.Activity">
              <ds-live-badge right [running]="running()" [ms]="out()?.computeMs" [source]="source()" />
              @if (!out() || parcels().length === 0) {
                <div class="flex h-64 flex-col items-center justify-center gap-2 text-center text-xs text-slate-400">
                  <div motion [animate]="bounce.animate" [transition]="bounce.transition"><ds-drosophila [size]="56" /></div>Dessinez un verger (ou choisissez un modèle) : les résultats apparaissent instantanément ici.
                </div>
              } @else if (active() && base()) {
                <div class="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                  <span class="h-2.5 w-2.5 rounded-full" [style.background-color]="activeColor()"></span>
                  <b class="truncate text-slate-800">{{ active()!.isBaseline ? 'Témoin sans protection' : active()!.name }}</b>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <ds-mini-kpi label="Récolte préservée" [value]="active()!.globalHarvest.toFixed(0) + ' %'" [delta]="harvestDelta()" unit="pts" />
                  <ds-mini-kpi label="Bilan vs témoin" [value]="fmtEur(net())" [tone]="net() >= 0 ? 'good' : 'bad'" />
                  <ds-mini-kpi label="Pic femelles/ha" [value]="active()!.peakDensity.toLocaleString('fr-FR')" [tone]="active()!.peakDensity > threshold ? 'bad' : 'good'" />
                  <ds-mini-kpi label="IFT chimique" [value]="active()!.ift.toFixed(1)" [tone]="active()!.ift > 2 ? 'bad' : 'good'" />
                </div>
                <div class="mt-3"><ds-population-chart [out]="out()!" [result]="active()!" [parcels]="parcels()" [height]="190" [compact]="true" /></div>
                <div class="mt-2"><ds-harvest-by-parcel-chart [out]="out()!" [parcels]="parcels()" [strategies]="strategies()" [height]="170" /></div>
              }
              <a routerLink="/results" class="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-transform hover:-translate-y-0.5 hover:bg-emerald-800">
                Voir l'analyse complète <svg [lucide]="I.ArrowRight" class="h-4 w-4"></svg>
              </a>
            </ds-panel>
          </div>
        </section>
      </main>

      @if (fullscreen()) {
        <div motion [initial]="{ opacity: 0, scale: 0.98 }" [animate]="{ opacity: 1, scale: 1 }" [exit]="{ opacity: 0, scale: 0.98 }" [transition]="{ duration: 0.18 }"
          class="fixed inset-0 z-50 flex flex-col bg-slate-50">
          <div class="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
            <svg [lucide]="I.Paintbrush" class="h-4 w-4 text-slate-500"></svg>
            <span class="text-sm font-extrabold text-slate-900">Éditeur parcellaire — plein écran</span>
            <span class="hidden text-[11px] text-slate-400 md:inline">Échap ou Maj+F pour quitter · [ ] taille du pinceau · 1-4 types · B R F E V outils</span>
            <span class="ml-auto"><ds-live-badge [running]="running()" [ms]="out()?.computeMs" [source]="source()" /></span>
            <button (click)="exitFullscreen()" class="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"><svg [lucide]="I.Minimize2" class="h-4 w-4"></svg> Réduire</button>
          </div>
          <div class="flex min-h-0 flex-1 gap-4 overflow-auto p-4">
            <div class="min-w-0 flex-1"><ds-grid-editor variant="fullscreen" /></div>
            <aside class="hidden w-[380px] shrink-0 space-y-3 overflow-y-auto xl:block">
              @if (active() && base()) {
                <ds-panel heading="Impact en direct" [icon]="I.Activity">
                  <div class="grid grid-cols-2 gap-2">
                    <ds-mini-kpi label="Récolte préservée" [value]="active()!.globalHarvest.toFixed(0) + ' %'" [delta]="harvestDelta()" unit="pts" />
                    <ds-mini-kpi label="Bilan vs témoin" [value]="fmtEur(net())" [tone]="net() >= 0 ? 'good' : 'bad'" />
                  </div>
                  <div class="mt-2"><ds-harvest-by-parcel-chart [out]="out()!" [parcels]="parcels()" [strategies]="strategies()" [height]="170" /></div>
                </ds-panel>
              }
              <ds-panel heading="Leviers de la stratégie active" [icon]="I.SlidersHorizontal"><ds-strategy-bar /><div class="mt-3"><ds-lever-matrix /></div></ds-panel>
            </aside>
          </div>
        </div>
      }
      <ds-onboarding />
    </div>
  `,
})
export class SimulatorPage {
  protected I = { ArrowRight, Zap, Minimize2, ChevronDown, Euro, SlidersHorizontal, Activity, Paintbrush };
  protected cn = cn;
  protected fmtEur = fmtEur;
  protected threshold = THRESHOLD;
  protected presets = PRESETS;
  protected tabs = TABS;
  protected bounce = { animate: { y: [0, -6, 0] }, transition: { duration: 2, repeat: 1e9 } };

  protected strategies = select(s => s.strategies);
  protected activeId = select(s => s.activeStrategyId);
  protected layout = select(s => s.layout);
  protected fullscreen = select(s => s.editorFullscreen);
  private economics = select(s => s.economics);
  private main = viewChild.required<ElementRef<HTMLElement>>('main');

  private sim = injectSimulation();
  protected out = this.sim.out;
  protected running = this.sim.running;
  protected parcels = this.sim.parcels;
  protected source = this.sim.source;
  protected showEco = signal(false);
  protected mobileTab = signal<'map' | 'levers' | 'live'>('map');

  protected active = computed(() => this.out()?.results.find(r => r.id === this.activeId()));
  protected activeColor = computed(() => this.strategies().find(s => s.id === this.activeId())?.color ?? null);
  protected base = computed(() => this.out()?.results.find(r => r.isBaseline));
  protected net = computed(() => { const a = this.active(), b = this.base(); return a && b ? a.revenue - b.revenue - a.totalCost : 0; });
  protected harvestDelta = computed(() => { const a = this.active(), b = this.base(); return !a || !b || a.isBaseline ? undefined : a.globalHarvest - b.globalHarvest; });
  protected subtitle = computed(() => {
    const ps = this.parcels();
    const haTotal = ps.reduce((a, p) => a + p.area, 0) * this.economics().cellAreaM2 / 10000;
    return `${ps.length} parcelles · ${haTotal.toFixed(2)} ha · ${this.strategies().length} stratégies`;
  });

  constructor() { injectShareHydration(); }

  protected setLayout(l: [number, number]) { gridStore.getState().setLayout(l); }
  protected isPreset(v: [number, number]) { const l = this.layout(); return Math.abs(l[0] - v[0]) < 1 && Math.abs(l[1] - v[1]) < 1; }
  protected exitFullscreen() { gridStore.getState().setEditorFullscreen(false); }

  protected startDrag(which: 0 | 1, e: PointerEvent) {
    e.preventDefault();
    const rect = this.main().nativeElement.getBoundingClientRect();
    const setLayout = gridStore.getState().setLayout;
    const move = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const [l, c] = gridStore.getState().layout;
      if (which === 0) { const nl = Math.min(54, Math.max(22, pct)); setLayout([nl, Math.max(24, Math.min(c, 100 - nl - 22))]); }
      else setLayout([l, Math.min(100 - l - 22, Math.max(24, pct - l))]);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
}
