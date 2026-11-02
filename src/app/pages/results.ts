import { Component, DestroyRef, afterNextRender, computed, effect, inject, input, output, signal, type Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft, Trophy, TrendingUp, Euro, Activity, BarChart3, Layers, Columns3, Map as MapIcon,
  Lightbulb, AlertTriangle, CheckCircle2, Info, ChevronDown, Printer, Settings2, Clock, Users, Radar as RadarIcon, type IconNode,
} from 'lucide';
import { AppHeader, LiveBadge, download, toast, injectShareHydration } from '@/components/AppHeader';
import {
  PopulationChart, HarvestByParcelChart, OverlayChart, EconomicsChart, RadarScore, HealthyFruitChart, YearlyHarvestChart,
  StrategyLegend, fmtEur, THRESHOLD, Empty,
} from '@/components/charts';
import { MiniMap } from '@/components/GridEditor';
import { LEVERS, SimulationSettings, EconomicsSettings } from '@/components/ControlPanel';
import { BuzzingFly, FlyingFlies } from '@/components/illustrations';
import { IconFly, IconClimate, IconHarvest } from '@/components/icons';
import { CountUp, RingGauge, Sparkline, Chapter, Grain, Contours, IsoOrchard, HillsBackdrop } from '@/components/art';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { gridStore, select, type Strategy, type Parcel } from '@/lib/store';
import { injectSimulation, type SimSource } from '@/lib/simulation';
import { dayLabel, isCherry, PHENOLOGY, type CellType, type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { projectPayload } from '@/lib/projectIO';

/** Icône Lucide (IconNode) ou icône maison (composant). */
type AnyIconT = IconNode | Type<unknown>;
type ColorFn = (id: string) => string;
const EASE = [0.16, 1, 0.3, 1];

/** Pic maximal du témoin (échelle commune des cartes) — boucle simple, sans copie ni spread de 400 valeurs */
function peakMax(r: StrategyResult) {
  let m = 1;
  for (let i = 0; i < r.peakByCell.length; i++) if (r.peakByCell[i] > m) m = r.peakByCell[i];
  return m;
}

// ======================================================================= Atomes
@Component({
  selector: 'ds-any-icon',
  imports: [Lucide, NgComponentOutlet],
  host: { style: 'display: contents' },
  template: `
    @if (isNode()) { <svg [lucide]="$any(icon())" [class]="className()"></svg> }
    @else { <ng-container *ngComponentOutlet="$any(icon()); inputs: { className: className() }" /> }
  `,
})
class AnyIcon {
  readonly icon = input.required<AnyIconT>();
  readonly className = input('');
  protected isNode = computed(() => Array.isArray(this.icon()));
}

/** Carte de section ; contenu projeté `[right]` (enveloppé par l'appelant dans un div.no-print). */
@Component({
  selector: 'ds-card',
  imports: [Motion, AnyIcon],
  host: { style: 'display: contents' },
  template: `
    <section motion [initial]="{ opacity: 0, y: 16 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true, margin: '-40px' }" [transition]="{ duration: 0.45, ease: ease }"
      [class]="cn('ico-host break-inside-avoid rounded-[28px] border border-white bg-white/90 p-5 shadow-[0_30px_60px_-35px_rgba(2,44,34,.3)] backdrop-blur transition-shadow duration-300 hover:shadow-[0_34px_70px_-30px_rgba(2,44,34,.4)] md:p-6', className())">
      <div class="mb-4 flex items-start gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 ring-1 ring-emerald-200/60"><ds-any-icon [icon]="icon()" className="h-5 w-5" /></span>
        <div class="min-w-0 flex-1"><h3 class="font-display text-lg font-semibold text-slate-900">{{ heading() }}</h3>@if (subtitle()) {<p class="text-[11px] text-slate-500">{{ subtitle() }}</p>}</div>
        <ng-content select="[right]" />
      </div>
      <ng-content />
    </section>
  `,
})
class Card {
  readonly heading = input.required<string>();
  readonly icon = input.required<AnyIconT>();
  readonly subtitle = input<string>();
  readonly className = input<string>();
  protected cn = cn;
  protected ease = EASE;
}

@Component({
  selector: 'ds-focus-picker',
  host: { style: 'display: contents' },
  template: `
    <select (change)="pick($event)" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700" [style.border-left]="'4px solid ' + (value() ? color()(value()!) : '#ccc')">
      @for (r of results(); track r.id) { <option [value]="r.id" [selected]="r.id === value()">{{ r.isBaseline ? 'Témoin' : r.name }}</option> }
    </select>
  `,
})
class FocusPicker {
  readonly results = input.required<StrategyResult[]>();
  readonly value = input<string>();
  readonly color = input.required<ColorFn>();
  readonly valueChange = output<string>();
  protected pick(e: Event) { this.valueChange.emit((e.target as HTMLSelectElement).value); }
}

@Component({
  selector: 'ds-skeleton-results',
  imports: [BuzzingFly],
  host: { style: 'display: contents' },
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-center gap-3 py-6 text-sm font-semibold text-slate-500"><ds-buzzing-fly [size]="40" /> Simulation en cours…</div>
      <div class="grid gap-4 md:grid-cols-3">
        @for (k of [0, 1, 2]; track k) { <div class="shimmer h-28 rounded-2xl" [style.animation-delay]="k * 0.15 + 's'"></div> }
        <div class="shimmer col-span-full h-72 rounded-3xl"></div>
        <div class="shimmer h-56 rounded-3xl md:col-span-2"></div><div class="shimmer h-56 rounded-3xl"></div>
      </div>
    </div>
  `,
})
class SkeletonResults {}

// ======================================================================= Blocs
const CHAPTERS = [
  { id: 'synthese', n: '01', label: 'Synthèse' }, { id: 'recolte', n: '02', label: 'Récolte' }, { id: 'dynamique', n: '03', label: 'Dynamique' },
  { id: 'economie', n: '04', label: 'Économie' }, { id: 'territoire', n: '05', label: 'Territoire' }, { id: 'leviers', n: '06', label: 'Décision' },
];

@Component({
  selector: 'ds-chapter-nav',
  host: { style: 'display: contents' },
  template: `
    <nav class="no-print sticky top-16 z-30 border-b border-slate-200/70 bg-[#F6F4EE]/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-4 py-2 md:px-8">
        @for (c of chapters; track c.id) {
          <a [href]="'#' + c.id" (click)="jump($event, c.id)" [class]="cn('group flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all', active() === c.id ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-white hover:text-slate-900')">
            <span [class]="cn('font-display text-[13px] italic', active() === c.id ? 'text-emerald-300' : 'text-slate-400')">{{ c.n }}</span>{{ c.label }}
          </a>
        }
      </div>
      <div class="h-0.5 origin-left bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" [style.transform]="'scaleX(' + progress() + ')'"></div>
    </nav>
  `,
})
class ChapterNav {
  protected chapters = CHAPTERS;
  protected active = signal('synthese');
  protected progress = signal(0);
  protected cn = cn;
  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const els = CHAPTERS.map(c => document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
      const obs = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) this.active.set(e.target.id); }); }, { rootMargin: '-35% 0px -60% 0px' });
      els.forEach(e => obs.observe(e));
      const onScroll = () => { const h = document.documentElement; this.progress.set(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)); };
      window.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => { obs.disconnect(); window.removeEventListener('scroll', onScroll); });
    });
  }
  /** Ancre « #id » : défilement doux sans passer par le routeur (qui réécrirait l'URL de la page). */
  protected jump(e: MouseEvent, id: string) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView(); // suit scroll-behavior (doux, sauf mouvement réduit)
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${id}`);
  }
}

interface Chip { icon: AnyIconT; label: string }

@Component({
  selector: 'ds-hero',
  imports: [RouterLink, Motion, Lucide, AnyIcon, LiveBadge, CountUp, Contours, Grain, HillsBackdrop, FlyingFlies, IsoOrchard],
  host: { style: 'display: contents' },
  template: `
    <section class="no-print relative overflow-hidden bg-[#03241C] text-white">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(244,63,94,.18),transparent_50%)]"></div>
      <ds-contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
      <ds-grain [opacity]="0.12" />
      <ds-hills-backdrop className="absolute inset-x-0 bottom-0 h-40 w-full" />
      <ds-flying-flies [count]="4" className="opacity-70" />

      <div class="relative mx-auto grid max-w-[1500px] items-center gap-10 px-4 pb-24 pt-10 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div>
          <div motion [initial]="{ opacity: 0, y: 10 }" [animate]="{ opacity: 1, y: 0 }" class="flex flex-wrap items-center gap-2">
            <a routerLink="/simulator" class="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 backdrop-blur hover:bg-white/20"><svg [lucide]="I.ArrowLeft" class="h-3.5 w-3.5"></svg> Modifier le verger</a>
            <ds-live-badge [running]="running()" [ms]="ms()" [source]="source()" />
          </div>
          <p motion [initial]="{ opacity: 0 }" [animate]="{ opacity: 1 }" [transition]="{ delay: 0.1 }" class="mt-8 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.3em] text-emerald-300">
            <svg [lucide]="I.Trophy" class="h-4 w-4"></svg> {{ best() ? (count() > 1 ? 'Verdict · meilleure stratégie sur ' + count() : 'Verdict de la simulation') : 'Témoin seul' }}
          </p>
          <h2 motion [initial]="{ opacity: 0, y: 24 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 0.15, duration: 0.7, ease: ease }"
            class="font-display mt-3 text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            @if (best()) {<em class="bg-gradient-to-r from-white via-emerald-200 to-amber-200 bg-clip-text not-italic text-transparent">{{ best()!.name }}</em>} @else {Ajoutez une stratégie}
          </h2>
          @if (best(); as b) {
            <p motion [initial]="{ opacity: 0 }" [animate]="{ opacity: 1 }" [transition]="{ delay: 0.35 }" class="mt-5 max-w-xl text-lg leading-relaxed text-emerald-50/80">
              @if (b.totalCost === 0 && abs(gainPts()) < 0.5) {n'active encore aucun levier : ses résultats sont ceux du témoin, <b class="text-white">{{ b.globalHarvest.toFixed(0) }} %</b> de récolte saine. Ajoutez un filet, une prophylaxie ou un traitement depuis l'éditeur.}
              @else {préserve <b class="text-white">{{ b.globalHarvest.toFixed(0) }} %</b> de la récolte, soit <b class="text-white">{{ gainPts() >= 0 ? '+' : '−' }}{{ abs(gainPts()).toFixed(0) }} point{{ abs(gainPts()) >= 2 ? 's' : '' }}</b> {{ gainPts() >= 0 ? 'de plus' : 'de moins' }} que sans protection, pour un bilan net de <b [class]="net() >= 0 ? 'text-emerald-300' : 'text-rose-300'">{{ fmtEur(net()) }}</b> par an.}
            </p>
          }
          <div class="mt-8 grid grid-cols-3 gap-3">
            <div motion [initial]="{ opacity: 0, y: 16 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 0.4 }" class="rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/15 backdrop-blur-md">
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Récolte préservée</p>
              <p class="font-display mt-1 text-2xl font-semibold sm:text-3xl md:text-4xl"><ds-count-up [value]="best()?.globalHarvest ?? base().globalHarvest" suffix=" %" /><span class="mt-1 block text-[11px] font-medium text-emerald-100/60">témoin {{ base().globalHarvest.toFixed(0) }} %</span></p>
            </div>
            <div motion [initial]="{ opacity: 0, y: 16 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 0.5 }" class="rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/15 backdrop-blur-md">
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Bilan net / an</p>
              <p class="font-display mt-1 text-2xl font-semibold sm:text-3xl md:text-4xl"><ds-count-up [value]="best() ? net() : 0" suffix=" €" [signed]="true" /><span class="mt-1 block text-[11px] font-medium text-emerald-100/60">coût {{ fmtEur(best()?.totalCost ?? 0) }}</span></p>
            </div>
            <div motion [initial]="{ opacity: 0, y: 16 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 0.6 }" class="rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/15 backdrop-blur-md">
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Pic de femelles</p>
              <p class="font-display mt-1 text-2xl font-semibold sm:text-3xl md:text-4xl"><ds-count-up [value]="(best() ?? base()).peakDensity / 1000" [decimals]="1" suffix="k" /><span class="mt-1 block text-[11px] font-medium text-emerald-100/60">témoin {{ (base().peakDensity / 1000).toFixed(0) }} k /ha</span></p>
            </div>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            @for (c of chips(); track c.label) {
              <span class="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-emerald-50/80 ring-1 ring-white/10"><ds-any-icon [icon]="c.icon" className="h-3.5 w-3.5 text-emerald-300" />{{ c.label }}</span>
            }
            <button (click)="toggleSettings.emit()" class="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-900 hover:bg-emerald-50">
              <svg [lucide]="I.Settings2" class="h-3.5 w-3.5"></svg> Réglages rapides <svg [lucide]="I.ChevronDown" [class]="cn('h-3.5 w-3.5 transition-transform', settingsOpen() && 'rotate-180')"></svg>
            </button>
          </div>
        </div>

        <div motion [initial]="{ opacity: 0, scale: 0.94, rotateX: 18 }" [animate]="{ opacity: 1, scale: 1, rotateX: 0 }" [transition]="{ duration: 1, ease: ease }" class="relative">
          <div class="absolute inset-x-10 bottom-6 h-16 rounded-full bg-black/40 blur-2xl"></div>
          <ds-iso-orchard [grid]="grid()" [heat]="shownRes().peakByCell" [max]="max()" className="relative w-full drop-shadow-2xl" />
          <div class="absolute left-1/2 top-0 flex -translate-x-1/2 rounded-full bg-black/30 p-1 ring-1 ring-white/15 backdrop-blur">
            <button (click)="view.set('base')" [class]="cn('rounded-full px-3 py-1 text-[11px] font-bold transition-all', view() === 'base' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white')">Sans protection</button>
            @if (best()) {
              <button (click)="view.set('best')" [class]="cn('rounded-full px-3 py-1 text-[11px] font-bold transition-all', view() === 'best' ? 'text-slate-900' : 'text-white/70 hover:text-white')"
                [style.background-color]="view() === 'best' ? '#fff' : null" [style.box-shadow]="view() === 'best' ? '0 0 0 2px ' + color() : null">{{ best()!.name }}</button>
            }
          </div>
          <div class="absolute bottom-2 right-2 flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/80 ring-1 ring-white/10 backdrop-blur">
            Pression maximale
            <span class="h-2 w-24 rounded-full" style="background: linear-gradient(90deg,#FEF08A,#F97316,#BE123C)"></span>
          </div>
        </div>
      </div>
    </section>
  `,
})
class Hero {
  readonly best = input<StrategyResult>();
  readonly net = input.required<number>();
  readonly base = input.required<StrategyResult>();
  readonly count = input.required<number>();
  readonly color = input.required<string>();
  readonly grid = input.required<CellType[]>();
  readonly chips = input.required<Chip[]>();
  readonly running = input.required<boolean>();
  readonly ms = input<number>();
  readonly source = input<SimSource>();
  readonly settingsOpen = input.required<boolean>();
  readonly toggleSettings = output<void>();

  protected I = { ArrowLeft, Trophy, Settings2, ChevronDown };
  protected cn = cn;
  protected fmtEur = fmtEur;
  protected abs = Math.abs;
  protected ease = EASE;
  protected view = signal<'best' | 'base'>('best');
  protected max = computed(() => peakMax(this.base()));
  protected shownRes = computed(() => (this.view() === 'best' && this.best() ? this.best()! : this.base()));
  protected gainPts = computed(() => { const b = this.best(); return b ? b.globalHarvest - this.base().globalHarvest : 0; });
}

@Component({
  selector: 'ds-podium',
  imports: [Motion, CountUp],
  host: { style: 'display: contents' },
  template: `
    <div class="rounded-[28px] border border-white bg-white/80 p-5 shadow-[0_30px_60px_-30px_rgba(2,44,34,.25)] backdrop-blur">
      <p class="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Classement par bilan net annuel</p>
      <ol class="space-y-3">
        @for (x of ranked(); track x.r.id; let i = $index) {
          <li motion [initial]="{ opacity: 0, x: -16 }" [whileInView]="{ opacity: 1, x: 0 }" [viewport]="{ once: true }" [transition]="{ delay: i * 0.08 }" class="grid grid-cols-[48px_1fr_auto] items-center gap-4">
            <span [class]="cn('font-display text-4xl font-black italic leading-none', i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-700/70' : 'text-slate-300')">{{ i + 1 }}</span>
            <div>
              <div class="mb-1 flex items-center justify-between text-sm"><span class="font-bold text-slate-800">{{ x.r.name }}</span><span class="text-[11px] text-slate-500">{{ x.r.globalHarvest.toFixed(0) }} % récolte · {{ (x.r.globalHarvest - base().globalHarvest).toFixed(0) }} pts vs témoin</span></div>
              <div class="relative h-3 overflow-hidden rounded-full bg-slate-100">
                <div motion class="absolute inset-y-0 left-0 rounded-full" [style.background]="'linear-gradient(90deg, ' + color()(x.r.id) + '88, ' + color()(x.r.id) + ')'"
                  [initial]="{ width: '0%' }" [whileInView]="{ width: barWidth(x.net) }" [viewport]="{ once: true }" [transition]="{ duration: 1, delay: 0.1 + i * 0.08, ease: ease }"></div>
              </div>
            </div>
            <span [class]="cn('font-display text-xl font-semibold tabular-nums', x.net >= 0 ? 'text-emerald-700' : 'text-rose-600')"><ds-count-up [value]="x.net" suffix=" €" [signed]="true" /></span>
          </li>
        }
      </ol>
    </div>
  `,
})
class Podium {
  readonly ranked = input.required<{ r: StrategyResult; net: number }[]>();
  readonly color = input.required<ColorFn>();
  readonly base = input.required<StrategyResult>();
  protected cn = cn;
  protected ease = EASE;
  private maxAbs = computed(() => Math.max(1, ...this.ranked().map(x => Math.abs(x.net))));
  protected barWidth(net: number) { return `${Math.max(3, (Math.abs(net) / this.maxAbs()) * 100)}%`; }
}

@Component({
  selector: 'ds-strategy-card',
  imports: [Motion, Lucide, CountUp, RingGauge, Sparkline, IconFly],
  host: { style: 'display: contents' },
  template: `
    <button motion [initial]="{ opacity: 0, y: 24 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" [transition]="{ delay: delay(), duration: 0.5 }" (click)="focus.emit()"
      [whileHover]="{ y: -4 }"
      [class]="cn('group relative overflow-hidden rounded-[28px] border bg-white p-5 text-left shadow-[0_24px_50px_-30px_rgba(15,23,42,.35)] transition-shadow', focused() ? 'border-transparent ring-2' : 'border-white')"
      [style.--tw-ring-color]="focused() ? c() : null">
      <div class="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40" [style.background-color]="c()"></div>
      @if (r().isBaseline) { <div class="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(45deg,#CBD5E1_0_6px,#94A3B8_6px_12px)]"></div> }
      <div class="relative mb-4 flex items-start gap-2">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.2em]" [style.color]="c()">{{ r().isBaseline ? 'Référence' : 'Stratégie' }}</p>
          <p class="font-display truncate text-xl font-semibold text-slate-900">{{ r().isBaseline ? 'Témoin sans protection' : r().name }}</p>
        </div>
        @if (best()) { <span class="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-2.5 py-1 text-[10px] font-black text-amber-950 shadow"><svg [lucide]="I.Trophy" class="h-3 w-3"></svg> N°1</span> }
      </div>
      <div class="relative flex items-center gap-4">
        <ds-ring-gauge [value]="r().globalHarvest" [color]="c()" [size]="96">
          <span class="font-display text-2xl font-semibold text-slate-900"><ds-count-up [value]="r().globalHarvest" /></span>
          <span class="-mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">% récolte</span>
        </ds-ring-gauge>
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5 last:border-0">
            <span class="text-[11px] text-slate-500">Bilan net / an</span>
            <span [class]="metric(r().isBaseline ? 'neutral' : net() >= 0 ? 'good' : 'bad')">@if (r().isBaseline) {<ng-container>CA {{ fmtEur(r().revenue) }}</ng-container>} @else {<ds-count-up [value]="net()" suffix=" €" [signed]="true" />}</span>
          </div>
          <div class="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5 last:border-0">
            <span class="text-[11px] text-slate-500">vs témoin</span>
            <span [class]="metric(r().isBaseline ? 'neutral' : d() > 0.5 ? 'good' : d() < -0.5 ? 'bad' : 'neutral')">{{ r().isBaseline ? '—' : (d() >= 0 ? '+' : '') + d().toFixed(1) + ' pts' }}</span>
          </div>
          <div class="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5 last:border-0">
            <span class="text-[11px] text-slate-500">IFT chimique</span>
            <span [class]="metric(r().ift === 0 ? 'good' : r().ift <= 2 ? 'neutral' : 'bad')">{{ r().ift.toFixed(1) }}</span>
          </div>
        </div>
      </div>
      <div class="relative mt-4 rounded-2xl bg-slate-50 p-3">
        <div class="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <span class="flex items-center gap-1"><ds-icon-fly className="h-3.5 w-3.5" /> Pression sur cerisiers</span>
          <span>pic <b class="text-slate-800">{{ (r().peakDensity / 1000).toFixed(1) }}k</b>/ha@if (!r().isBaseline) {<b [class]="cn('ml-1', peakDelta() < 0 ? 'text-emerald-600' : 'text-rose-600')">{{ peakDelta() > 0 ? '+' : '' }}{{ peakDelta() }} %</b>}</span>
        </div>
        <ds-sparkline [data]="spark()" [color]="c()" [width]="300" [height]="38" className="w-full" />
        <div class="mt-1 flex justify-between text-[10px] text-slate-400"><span>{{ fmtEur(r().totalCost) }} de leviers</span><span>{{ r().laborHours }} h de travail</span></div>
      </div>
    </button>
  `,
})
class StrategyCard {
  readonly r = input.required<StrategyResult>();
  readonly base = input.required<StrategyResult>();
  readonly color = input.required<string>();
  readonly best = input.required<boolean>();
  readonly delay = input.required<number>();
  readonly focused = input.required<boolean>();
  readonly focus = output<void>();

  protected I = { Trophy };
  protected cn = cn;
  protected fmtEur = fmtEur;
  protected d = computed(() => this.r().globalHarvest - this.base().globalHarvest);
  protected net = computed(() => this.r().revenue - this.base().revenue - this.r().totalCost);
  protected peakDelta = computed(() => Math.round((this.r().peakDensity / Math.max(1, this.base().peakDensity) - 1) * 100));
  protected spark = computed(() => this.r().series.filter((_, i) => i % 3 === 0).map(p => Number(p['cherry_all']) || 0));
  protected c = computed(() => (this.r().isBaseline ? '#94A3B8' : this.color()));
  protected metric(tone: 'good' | 'bad' | 'neutral') {
    return cn('font-display text-base font-semibold tabular-nums', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-600' : 'text-slate-800');
  }
}

@Component({
  selector: 'ds-final-cta',
  imports: [RouterLink, Lucide, Contours, Grain],
  host: { style: 'display: contents' },
  template: `
    <section class="no-print relative overflow-hidden bg-[#03241C] py-20 text-white">
      <ds-contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
      <ds-grain [opacity]="0.12" />
      <div class="relative mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-xs font-extrabold uppercase tracking-[0.3em] text-emerald-300">Et maintenant ?</p>
          <h3 class="font-display mt-2 text-4xl font-semibold md:text-5xl">Affinez, comparez, <em class="text-amber-200">partagez.</em></h3>
          <p class="mt-3 max-w-lg text-emerald-50/70">Ajustez un levier dans l'éditeur : tous les résultats se recalculent instantanément. Exportez une Fiche Conseil pour votre prochain tour de plaine.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <a routerLink="/simulator" class="rounded-2xl bg-white px-6 py-4 font-bold text-slate-900 hover:bg-emerald-50">Retour à l'éditeur</a>
          <button (click)="print()" class="flex items-center gap-2 rounded-2xl border border-white/30 px-6 py-4 font-bold hover:bg-white/10"><svg [lucide]="I.Printer" class="h-5 w-5"></svg> Fiche Conseil PDF</button>
          <a routerLink="/docs/modele" class="rounded-2xl border border-white/30 px-6 py-4 font-bold hover:bg-white/10">Comprendre le modèle</a>
        </div>
      </div>
    </section>
  `,
})
class FinalCta {
  protected I = { Printer };
  protected print() { window.print(); }
}

@Component({
  selector: 'ds-heat-panel',
  imports: [IsoOrchard, MiniMap],
  host: { style: 'display: contents' },
  template: `
    <div class="grid items-center gap-4 md:grid-cols-[1fr_200px]">
      <div class="relative rounded-3xl bg-gradient-to-b from-sky-50 to-[#F3EEDF] p-2">
        <ds-iso-orchard [grid]="grid()" [heat]="focus().peakByCell" [max]="max()" className="w-full" />
        <span class="absolute left-4 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-800 shadow">{{ focus().isBaseline ? 'Témoin' : focus().name }}</span>
      </div>
      <div class="space-y-3">
        <div class="rounded-2xl bg-slate-50 p-3 text-center"><ds-mini-map [grid]="grid()" [values]="focus().peakByCell" [max]="max()" [size]="168" /><p class="mt-1 text-[10px] text-slate-500">Vue de dessus</p></div>
        <div>
          <div class="h-2 rounded-full" style="background: linear-gradient(90deg,#FEF08A,#F97316,#BE123C)"></div>
          <div class="mt-1 flex justify-between text-[10px] text-slate-500"><span>0</span><span>{{ maxLabel() }} /ha</span></div>
          <p class="mt-2 text-[11px] leading-relaxed text-slate-500">Les zones claires montrent l'effet protecteur ; le réservoir sauvage alimente les bordures.</p>
        </div>
      </div>
    </div>
  `,
})
class HeatPanel {
  readonly focus = input.required<StrategyResult>();
  readonly base = input.required<StrategyResult>();
  readonly grid = input.required<CellType[]>();
  protected max = computed(() => peakMax(this.base()));
  protected maxLabel = computed(() => Math.round(this.max()).toLocaleString('fr-FR'));
}

@Component({
  selector: 'ds-lever-table',
  imports: [NgComponentOutlet],
  host: { style: 'display: contents' },
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
            <th class="py-2 pr-3">Parcelle</th><th class="py-2 pr-3">Surface</th>
            @for (s of strategies(); track s.id) { <th class="py-2 pr-3"><span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" [style.background-color]="s.color"></span>{{ s.isBaseline ? 'Témoin' : s.name }}</span></th> }
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          @for (p of parcels(); track p.id) {
            <tr>
              <td class="py-2 pr-3 font-semibold text-slate-800"><span class="flex items-center gap-2"><span [class]="cn('h-3 w-3 rounded', p.type === 'forest' && 'hatch')" [style.background-color]="p.color"></span>{{ p.name }}</span></td>
              <td class="py-2 pr-3 font-mono text-slate-500">{{ (p.area * haPerCell()).toFixed(2) }} ha</td>
              @for (s of strategies(); track s.id) {
                @let lv = s.leversByParcel[p.id];
                @let on = activeLevers(s, p);
                @let h = resultById().get(s.id)?.harvestByParcel?.[p.id];
                <td class="py-2 pr-3">
                  <div class="flex flex-wrap items-center gap-1">
                    @for (l of on; track l.key) {
                      <span class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" [style.background-color]="l.color" [title]="l.label">
                        <ng-container *ngComponentOutlet="l.icon; inputs: { className: 'h-3 w-3' }" />{{ l.short }}
                        @if (l.key === 'treatment' && lv) {<span class="opacity-80">×{{ lv.treatmentPasses }}{{ lv.treatmentMode === 'biocontrol' ? ' bio' : '' }}</span>}
                        @if (l.key === 'netting' && lv) {<span class="opacity-80">{{ lv.netType === 'monorang' ? 'mono' : 'parc.' }}</span>}
                      </span>
                    } @empty {<span class="text-slate-300">—</span>}
                    @if (h !== undefined) {<span [class]="cn('ml-1 font-mono text-[10px] font-bold', h >= 90 ? 'text-emerald-600' : h >= 70 ? 'text-amber-600' : 'text-red-600')">{{ h.toFixed(0) }}%</span>}
                  </div>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
class LeverTable {
  readonly strategies = input.required<Strategy[]>();
  readonly parcels = input.required<Parcel[]>();
  readonly results = input.required<StrategyResult[]>();
  readonly haPerCell = input.required<number>();
  protected cn = cn;
  // index stratégie → résultat : évite un results.find() dans la double boucle parcelles × stratégies
  protected resultById = computed(() => new Map(this.results().map(r => [r.id, r])));
  protected activeLevers(s: Strategy, p: Parcel) {
    const lv = s.leversByParcel[p.id];
    return LEVERS.filter(l => lv?.[l.key] && l.targets(p.type));
  }
}

const COST_ROWS: [string, (r: StrategyResult, base: StrategyResult) => string][] = [
  ['Filets (amortis)', r => fmtEur(r.costs.net)], ['Produits phyto / bio', r => fmtEur(r.costs.phyto)], ['Main-d’œuvre (pose, passages, prophylaxie)', r => fmtEur(r.costs.labor)],
  ['Parasitoïdes', r => fmtEur(r.costs.bio)], ['TIS', r => fmtEur(r.costs.tis)], ['Coût total', r => fmtEur(r.totalCost)],
  ['CA sauvé vs témoin', (r, b) => fmtEur(r.revenue - b.revenue)], ['Bilan net', (r, b) => fmtEur(r.revenue - b.revenue - r.totalCost)],
  ['Retour sur investissement', (r, b) => (r.totalCost ? `${Math.round(((r.revenue - b.revenue) / r.totalCost) * 100)} %` : '—')],
  ['Heures de travail', r => `${r.laborHours} h`], ['IFT chimique', r => r.ift.toFixed(1)],
];

@Component({
  selector: 'ds-cost-table',
  imports: [Empty],
  host: { style: 'display: contents' },
  template: `
    @if (!results().length) { <ds-empty>Ajoutez une stratégie pour voir le détail des coûts.</ds-empty> }
    @else {
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead><tr class="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500"><th class="py-2 pr-3"></th>@for (r of results(); track r.id) {<th class="py-2 pr-3 text-right"><span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full" [style.background-color]="color()(r.id)"></span>{{ r.name }}</span></th>}</tr></thead>
          <tbody class="divide-y divide-slate-100">
            @for (row of rows; track row[0]) {
              <tr [class]="cn(['Coût total', 'Bilan net'].includes(row[0]) && 'bg-slate-50 font-bold')">
                <td class="py-1.5 pr-3 text-slate-600">{{ row[0] }}</td>
                @for (r of results(); track r.id) { <td class="py-1.5 pr-3 text-right font-mono text-slate-900">{{ row[1](r, base()) }}</td> }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
class CostTable {
  readonly results = input.required<StrategyResult[]>();
  readonly base = input.required<StrategyResult>();
  readonly color = input.required<ColorFn>();
  protected rows = COST_ROWS;
  protected cn = cn;
}

/** Texte de recommandation : segments, `b` = en gras. */
type Rec = { tone: 'good' | 'warn' | 'info'; parts: { t: string; b?: boolean }[] };
const B = (t: string) => ({ t, b: true });
const T = (t: string) => ({ t });

@Component({
  selector: 'ds-recommendations',
  imports: [Card, Motion, Lucide],
  host: { style: 'display: contents' },
  template: `
    <ds-card heading="Recommandations" [icon]="I.Lightbulb" subtitle="Générées automatiquement à partir des résultats de la simulation">
      <ul class="space-y-2">
        @for (r of recs(); track $index; let i = $index) {
          <li motion [initial]="{ opacity: 0, x: -8 }" [animate]="{ opacity: 1, x: 0 }" [transition]="{ delay: i * 0.04 }" class="flex gap-2.5 rounded-xl border border-slate-100 p-2.5 text-xs leading-relaxed text-slate-700">
            <span [class]="cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', C[r.tone])"><svg [lucide]="TONE_ICON[r.tone]" class="h-3.5 w-3.5"></svg></span><span>@for (p of r.parts; track $index) {@if (p.b) {<b>{{ p.t }}</b>} @else {<ng-container>{{ p.t }}</ng-container>}}</span>
          </li>
        }
      </ul>
    </ds-card>
  `,
})
class Recommendations {
  readonly results = input.required<StrategyResult[]>();
  readonly base = input.required<StrategyResult>();
  readonly parcels = input.required<Parcel[]>();
  private strategies = select(s => s.strategies);
  protected I = { Lightbulb };
  protected TONE_ICON = { good: CheckCircle2, warn: AlertTriangle, info: Lightbulb };
  protected C = { good: 'text-emerald-600 bg-emerald-50', warn: 'text-amber-600 bg-amber-50', info: 'text-blue-600 bg-blue-50' };
  protected cn = cn;

  protected recs = computed(() => {
    const results = this.results(), base = this.base(), parcels = this.parcels(), strategies = this.strategies();
    const recs: Rec[] = [];
    const strats = results.filter(r => !r.isBaseline);
    const cherry = parcels.filter(p => isCherry(p.type));
    // parcelles les plus exposées dans le témoin
    const worst = [...cherry].sort((a, b) => (base.harvestByParcel[a.id] ?? 100) - (base.harvestByParcel[b.id] ?? 100))[0];
    if (worst && (base.harvestByParcel[worst.id] ?? 100) < 85)
      recs.push({ tone: 'warn', parts: [T('Sans protection, '), B(worst.name), T(' ne conserve que '), B(`${base.harvestByParcel[worst.id]?.toFixed(0)} %`), T(` de sa récolte : c'est la parcelle prioritaire (${isCherry(worst.type) ? PHENOLOGY[worst.type].label.toLowerCase() : ''}, mûre quand la population atteint son pic).`)] });
    const early = cherry.filter(p => p.type === 'early-cherry' && (base.harvestByParcel[p.id] ?? 0) > 90);
    if (early.length) recs.push({ tone: 'info', parts: [T(`Les variétés précoces (${early.map(p => p.name).join(', ')}) sont récoltées avant l'explosion estivale : une protection légère suffit souvent.`)] });
    if (strats.length) {
      const byNet = [...strats].sort((a, b) => (b.revenue - b.totalCost) - (a.revenue - a.totalCost));
      const top = byNet[0];
      const topNet = top.revenue - base.revenue - top.totalCost;
      const hasLevers = parcels.some(p => { const l = strategies.find(s => s.id === top.id)?.leversByParcel[p.id]; return l && (l.netting || l.prophylaxis || l.treatment || l.parasitoids || l.tis); });
      if (!hasLevers) recs.push({ tone: 'info', parts: [B(top.name), T(" n'active aucun levier : ses résultats sont identiques au témoin. Ajoutez un filet, une prophylaxie ou un traitement depuis l'éditeur.")] });
      else if (strats.length === 1) recs.push({ tone: topNet >= 0 ? 'good' : 'warn', parts: [B(top.name), T(` dégage un bilan de ${fmtEur(topNet)} / an par rapport au témoin${topNet >= 0 ? '' : ' : les leviers coûtent plus que la récolte sauvée'}.`)] });
      else recs.push({ tone: 'good', parts: [B(top.name), T(` offre le meilleur bilan économique (${fmtEur(topNet)} / an vs témoin).`)] });
      const green = [...strats].sort((a, b) => a.ift - b.ift || b.globalHarvest - a.globalHarvest)[0];
      if (green.id !== top.id && green.ift < top.ift) recs.push({ tone: 'info', parts: [T("Pour réduire l'IFT, "), B(green.name), T(` (IFT ${green.ift.toFixed(1)}) préserve ${green.globalHarvest.toFixed(0)} % de la récolte.`)] });
      strats.forEach(s => { if (s.revenue - base.revenue - s.totalCost < 0) recs.push({ tone: 'warn', parts: [B(s.name), T(` coûte plus qu'elle ne rapporte (${fmtEur(s.revenue - base.revenue - s.totalCost)} / an) : ciblez les leviers sur les parcelles les plus exposées.`)] }); });
      strats.forEach(s => { if (s.peakDensity > THRESHOLD * 4) recs.push({ tone: 'warn', parts: [T('Avec '), B(s.name), T(`, la pression dépasse encore largement le seuil (${s.peakDensity.toLocaleString('fr-FR')} femelles/ha) : risque de résistance et de dégâts tardifs.`)] }); });
      const hasMultiYear = Object.values(strats[0].harvestByParcelYear).some(a => a.length > 1);
      if (hasMultiYear) {
        const decl = strats.find(s => Object.values(s.harvestByParcelYear).some(a => a.length > 1 && a[a.length - 1] < a[0] - 10));
        if (decl) recs.push({ tone: 'warn', parts: [T('Avec '), B(decl.name), T(", la récolte se dégrade d'année en année : le réservoir n'est pas maîtrisé. Envisagez prophylaxie et parasitoïdes dans les espaces naturels.")] });
      }
    } else recs.push({ tone: 'info', parts: [T("Créez une stratégie dans l'éditeur pour obtenir des recommandations comparatives.")] });
    if (parcels.some(p => p.type === 'forest')) recs.push({ tone: 'info', parts: [T('Les espaces naturels servent de réservoir hivernal : les lâchers de parasitoïdes y agissent sur le long terme (années 2-3).')] });
    return recs;
  });
}

@Component({
  selector: 'ds-hypotheses',
  imports: [RouterLink, Lucide],
  host: { style: 'display: contents' },
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button (click)="open.set(!open())" class="flex w-full items-center gap-2 p-4 text-left">
        <svg [lucide]="I.Info" class="h-4 w-4 text-slate-500"></svg><span class="text-sm font-bold text-slate-800">Hypothèses du modèle (transparence pour chercheurs et conseillers)</span>
        <a routerLink="/docs/modele" (click)="$event.stopPropagation()" class="ml-3 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">Documentation complète →</a>
        <svg [lucide]="I.ChevronDown" [class]="cn('ml-auto h-4 w-4 text-slate-400 transition-transform', open() && 'rotate-180')"></svg>
      </button>
      @if (open()) {
        <div class="grid gap-4 border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-600 md:grid-cols-2">
          <div>
            <p class="mb-1 font-bold text-slate-800">Dynamique (modèle v2, pas journalier, grille 20×20)</p>
            <ul class="list-disc space-y-1 pl-4">
              <li>Par case : femelles adultes A et trois sous-stades immatures (œufs → larves → pupes, ~210 degrés-jours au-dessus de 8 °C, délai de développement réaliste).</li>
              <li>Ponte = 8 œufs/j × aptitude thermique (optimum 20-26 °C, arrêt &gt; 33 °C) × ressource fruitière × densité-dépendance, avec une capacité d'accueil proportionnelle aux fruits disponibles le jour même.</li>
              <li>Mortalité adulte 2,8 %/j, majorée progressivement par le froid (&lt; 6 °C, selon le profil d'hiver, ÷ 2 à l'abri des espaces naturels), la chaleur (&gt; 28 °C), le surpeuplement et les zones non cultivées.</li>
              <li>Climat : sinusoïde annuelle + variabilité synoptique déterministe (± 3 °C) ; véraison pilotée par les degrés-jours cumulés, donc décalée selon le profil.</li>
              <li>Dispersion : 12 %/j (3 % par temps froid) vers les 8 voisines, pondérée par l'attractivité (cerisiers en véraison ×3) ; les filets freinent l'entrée et la sortie.</li>
              <li>Fruits sains : décroissance exponentielle avec les œufs pondus pendant la fenêtre véraison → récolte.</li>
            </ul>
          </div>
          <div>
            <p class="mb-1 font-bold text-slate-800">Leviers</p>
            <ul class="list-disc space-y-1 pl-4">
              <li><b>Filet</b> : accès aux fruits −95 % (monorang) / −85 % (monoparcelle), mouvements à travers le filet −67/−60 % dans les deux sens.</li>
              <li><b>Traitement</b> : mortalité adulte +32 %/j pendant 7 j (chimie) ou +16 %/j pendant 4 j (biocontrôle), rémanence −40 % si printemps humide, DAR 3 j ; coût et IFT calculés sur les passages réellement déclenchés.</li>
              <li><b>Prophylaxie</b> : fruits résiduels = 1 − taux de récolte ; ×0,25 si destruction des fruits au sol ; réduit la capacité d'accueil post-récolte.</li>
              <li><b>Parasitoïdes</b> : jusqu'à 38 % des larves parasitées (×1,4 en dose renforcée, plafond 75 %), installation progressive sur 3 ans.</li>
              <li><b>TIS</b> : fécondité fertile ÷ (1 + 0,12 × ratio) de fin mars à mi-septembre.</li>
              <li>Économie : CA = surface × rendement × prix × % fruits sains. Coûts par défaut/ha/an (filet 2 600-3 800 €, MO 16 €/h incluant pose des filets et passages, phyto 85-150 €/passage, parasitoïdes 300-520 €, TIS 950 €) — tous modifiables dans « Hypothèses économiques ».</li>
            </ul>
            <p class="mt-2 italic text-slate-400">Modèle pédagogique d'aide à la décision, non calibré sur données terrain : comparer les ordres de grandeur, pas les valeurs absolues.</p>
          </div>
        </div>
      }
    </section>
  `,
})
class Hypotheses {
  protected open = signal(false);
  protected I = { Info, ChevronDown };
  protected cn = cn;
}

// ======================================================================= Page
const CLIMATE_LABEL = { 'mild-winter': 'Hiver doux', 'harsh-winter': 'Hiver rigoureux', 'humid-spring': 'Printemps humide', 'dry-summer': 'Été caniculaire' } as const;

@Component({
  selector: 'ds-results-page',
  imports: [
    RouterLink, Motion, Lucide, AppHeader, BuzzingFly, MiniMap, SimulationSettings, EconomicsSettings, Chapter,
    PopulationChart, HarvestByParcelChart, OverlayChart, EconomicsChart, RadarScore, HealthyFruitChart, YearlyHarvestChart, StrategyLegend,
    Card, FocusPicker, SkeletonResults, ChapterNav, Hero, Podium, StrategyCard, FinalCta, HeatPanel, LeverTable, CostTable, Recommendations, Hypotheses,
  ],
  host: { style: 'display: contents' },
  template: `
    @if (parcels().length === 0) {
      <div class="min-h-screen bg-slate-50">
        <ds-app-header [title]="'Résultats'" [step]="2" />
        <div class="mx-auto mt-24 max-w-md text-center">
          <ds-buzzing-fly [size]="72" />
          <h2 class="mt-4 text-xl font-extrabold text-slate-900">Aucun verger à analyser</h2>
          <p class="mt-2 text-sm text-slate-500">Dessinez d'abord vos parcelles, ou chargez la démo.</p>
          <div class="mt-6 flex justify-center gap-2">
            <a routerLink="/simulator" class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Dessiner mon verger</a>
            <button (click)="loadDemo()" class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Charger la démo</button>
          </div>
        </div>
      </div>
    } @else {
      <div class="min-h-screen bg-[#F6F4EE]">
        <ds-app-header [title]="'Résultats & comparateur'" subtitle="Bilan technico-économique multi-stratégies" [step]="2" [csv]="true" (exportCsv)="exportCsv()">
          <button right (click)="print()" aria-label="Fiche Conseil PDF" class="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><svg [lucide]="I.Printer" class="h-4 w-4"></svg> <span class="hidden sm:inline">Fiche Conseil PDF</span></button>
        </ds-app-header>

        <!-- En-tête impression -->
        <div class="hidden px-6 pt-4 print:block">
          <div class="flex items-start justify-between border-b-2 border-emerald-700 pb-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-emerald-700">Fiche Conseil — Drosophila suzukii</p>
              <h1 class="text-2xl font-extrabold text-slate-900">Comparatif de stratégies de protection</h1>
              <p class="text-xs text-slate-500">Édité le {{ today }} · DrosoSim Next · {{ parcels().length }} parcelles · {{ cherryHa().toFixed(2) }} ha de cerisiers · {{ simParams().durationYears }} an(s) · {{ climateLabel() }}</p>
            </div>
            <ds-mini-map [grid]="grid()" [size]="110" />
          </div>
        </div>

        @if (!shown() || !base()) { <main class="mx-auto max-w-[1500px] p-6"><ds-skeleton-results /></main> }
        @else {
          @let sh = shown()!;
          @let b = base()!;
          <ds-hero [best]="best()?.r" [net]="best()?.net ?? 0" [base]="b" [count]="ranked().length" [color]="best() ? color(best()!.r.id) : '#10B981'" [grid]="grid()"
            [running]="running()" [ms]="out()?.computeMs" [source]="source()" [chips]="chips()"
            [settingsOpen]="showSettings()" (toggleSettings)="showSettings.set(!showSettings())" />

          @if (showSettings()) {
            <div motion [initial]="{ opacity: 0, y: -8 }" [animate]="{ opacity: 1, y: 0 }" class="no-print relative z-20 mx-auto -mt-6 grid max-w-[1400px] gap-6 rounded-[28px] border border-white bg-white/95 p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur md:grid-cols-2">
              <ds-simulation-settings />
              <div><p class="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Hypothèses économiques</p><ds-economics-settings /><p class="mt-2 text-[11px] text-slate-500">Toute modification relance instantanément la simulation des {{ strategies().length }} stratégies.</p></div>
            </div>
          }

          <ds-chapter-nav />

          <main class="relative mx-auto max-w-[1500px] space-y-24 px-4 pb-24 pt-12 md:px-8">
            <ds-chapter [id]="'synthese'" n="01" kicker="Synthèse" [title]="'Le classement des '"><em chapterTitle class="text-emerald-700">stratégies</em>
              <div class="no-print mb-5 flex flex-wrap items-center gap-2">
                <span class="mr-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Comparer</span>
                @for (r of out()!.results; track r.id) {
                  <button [disabled]="r.isBaseline" (click)="toggleExcluded(r.id)"
                    [class]="cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all', excluded()[r.id] ? 'border-dashed border-slate-300 bg-transparent text-slate-400 line-through' : 'border-white bg-white text-slate-800 shadow-sm hover:shadow', r.isBaseline && 'cursor-default')">
                    <span class="h-2.5 w-2.5 rounded-full" [style.background-color]="color(r.id)"></span>{{ r.isBaseline ? 'Témoin' : r.name }}
                  </button>
                }
                <div class="ml-auto flex rounded-full bg-white p-1 shadow-sm">
                  <button (click)="mode.set('columns')" [class]="modeBtn(mode() === 'columns')"><svg [lucide]="I.Columns3" class="h-3.5 w-3.5"></svg>Côte à côte</button>
                  <button (click)="mode.set('overlay')" [class]="modeBtn(mode() === 'overlay')"><svg [lucide]="I.Layers" class="h-3.5 w-3.5"></svg>Superposition</button>
                </div>
              </div>
              @if (ranked().length > 1) { <ds-podium [ranked]="ranked()" [color]="color" [base]="b" /> }
              <div class="mt-6 grid gap-5" [style.grid-template-columns]="'repeat(auto-fit, minmax(' + (sh.results.length > 3 ? 270 : 300) + 'px, 1fr))'">
                @for (r of sh.results; track r.id; let i = $index) {
                  <ds-strategy-card [r]="r" [base]="b" [color]="color(r.id)" [best]="best()?.r?.id === r.id" [delay]="i * 0.07" (focus)="focusId.set(r.id)" [focused]="focus()?.id === r.id" />
                }
              </div>
            </ds-chapter>

            <ds-chapter [id]="'recolte'" n="02" kicker="Récolte" [title]="'Ce que chaque levier '"><em chapterTitle class="text-emerald-700">sauve</em>
              <div class="grid gap-6 xl:grid-cols-3">
                <ds-card className="xl:col-span-2" heading="Récolte saine par parcelle" [icon]="I.BarChart3" subtitle="Valeur exacte au sommet de chaque barre · barre hachurée = témoin sans levier">
                  <ds-harvest-by-parcel-chart [out]="sh" [parcels]="parcels()" [strategies]="strategies()" [height]="320" />
                </ds-card>
                <ds-card heading="Année après année" [icon]="I.TrendingUp" [subtitle]="focus() ? 'Stratégie : ' + (focus()!.isBaseline ? 'Témoin' : focus()!.name) : ''">
                  <div right class="no-print"><ds-focus-picker [results]="sh.results" [value]="focus()?.id" (valueChange)="focusId.set($event)" [color]="color" /></div>
                  @if (focus()) { <ds-yearly-harvest-chart [result]="focus()!" [parcels]="parcels()" [height]="320" /> }
                </ds-card>
              </div>
            </ds-chapter>

            <ds-chapter [id]="'dynamique'" n="03" kicker="Dynamique" [title]="'La vie de la '"><em chapterTitle class="text-emerald-700">population</em>
              <ds-card [heading]="mode() === 'overlay' ? 'Pression moyenne sur les cerisiers — toutes stratégies' : 'Femelles adultes par parcelle'" [icon]="I.Activity"
                [subtitle]="mode() === 'overlay' ? 'Bandes rouges = périodes de sensibilité des fruits' : 'Légende cliquable · bandes = maturité des fruits · 🚜 traitement 🛡️ filet 🧺 récolte 🐝 parasitoïdes 🧬 TIS'">
                @if (mode() === 'columns') { <div right class="no-print"><ds-focus-picker [results]="sh.results" [value]="focus()?.id" (valueChange)="focusId.set($event)" [color]="color" /></div> }
                @if (mode() === 'overlay') {
                  <ds-overlay-chart [out]="sh" [strategies]="strategies()" [height]="400" /><ds-strategy-legend [results]="sh.results" [strategies]="strategies()" />
                } @else if (focus()) {
                  <ds-population-chart [out]="sh" [result]="focus()!" [parcels]="parcels()" [height]="420" />
                }
                <p class="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><svg [lucide]="I.Info" class="h-3.5 w-3.5"></svg> Le pic de juillet détruit la cerise tardive mais épargne la précoce, déjà récoltée : les bandes colorées matérialisent ces fenêtres de sensibilité.</p>
              </ds-card>
            </ds-chapter>

            <ds-chapter [id]="'economie'" n="04" kicker="Économie" [title]="'Le bilan, '" className="print-break"><em chapterTitle class="text-emerald-700">euro par euro</em>
              <div class="grid gap-6 lg:grid-cols-2">
                <ds-card heading="Bilan économique annuel" [icon]="I.Euro" subtitle="CA sauvé vs témoin (vert) face aux coûts des leviers · ● bilan net">
                  <ds-economics-chart [out]="sh" [strategies]="strategies()" [height]="340" />
                </ds-card>
                <ds-card heading="Profil multicritère" [icon]="I.RadarIcon" subtitle="0-100 : plus la surface est grande, meilleure est la stratégie">
                  <ds-radar-score [out]="sh" [strategies]="strategies()" [height]="320" />
                  <ds-strategy-legend [results]="sh.results" [strategies]="strategies()" />
                </ds-card>
              </div>
            </ds-chapter>

            <ds-chapter [id]="'territoire'" n="05" kicker="Territoire" [title]="'Où la mouche '"><em chapterTitle class="text-emerald-700">frappe</em>
              <div class="grid gap-6 lg:grid-cols-5">
                <ds-card className="lg:col-span-3" heading="Carte de pression maximale" [icon]="I.MapIcon" subtitle="Pic de femelles/ha par case, échelle commune au témoin — les drosophiles survolent les zones les plus touchées">
                  <div right class="no-print"><ds-focus-picker [results]="sh.results" [value]="focus()?.id" (valueChange)="focusId.set($event)" [color]="color" /></div>
                  @if (focus()) { <ds-heat-panel [focus]="focus()!" [base]="b" [grid]="grid()" /> }
                </ds-card>
                <ds-card className="lg:col-span-2" heading="Fruits sains au fil du temps" [icon]="IconHarvest" subtitle="% de fruits indemnes (cerisiers), pondéré par la surface">
                  <ds-healthy-fruit-chart [out]="sh" [parcels]="parcels()" [strategies]="strategies()" [height]="340" />
                  <ds-strategy-legend [results]="sh.results" [strategies]="strategies()" />
                </ds-card>
              </div>
            </ds-chapter>

            <ds-chapter [id]="'leviers'" n="06" kicker="Décision" [title]="'Leviers, coûts & '"><em chapterTitle class="text-emerald-700">conseils</em>
              <div class="space-y-6">
                <ds-card heading="Leviers retenus par stratégie" [icon]="I.Layers" subtitle="Leviers actifs par parcelle et récolte saine correspondante">
                  <ds-lever-table [strategies]="shownStrategies()" [parcels]="parcels()" [results]="sh.results" [haPerCell]="haPerCell()" />
                </ds-card>
                <div class="grid gap-6 lg:grid-cols-2">
                  <ds-recommendations [results]="sh.results" [base]="b" [parcels]="parcels()" />
                  <ds-card heading="Détail des coûts & contraintes" [icon]="I.Users" subtitle="Par an, sur l'ensemble de l'exploitation">
                    <ds-cost-table [results]="nonBaseline()" [base]="b" [color]="color" />
                  </ds-card>
                </div>
                <ds-hypotheses />
              </div>
            </ds-chapter>
          </main>

          <ds-final-cta />
        }
      </div>
    }
  `,
})
export class ResultsPage {
  protected I = { Printer, Columns3, Layers, BarChart3, TrendingUp, Activity, Euro, RadarIcon, MapIcon, Users, Info };
  protected IconHarvest = IconHarvest;
  protected cn = cn;
  protected today = new Date().toLocaleDateString('fr-FR');

  protected strategies = select(s => s.strategies);
  protected grid = select(s => s.grid);
  protected simParams = select(s => s.simParams);
  protected economics = select(s => s.economics);
  private sim = injectSimulation();
  protected out = this.sim.out;
  protected running = this.sim.running;
  protected parcels = this.sim.parcels;
  protected source = this.sim.source;
  protected excluded = signal<Record<string, boolean>>({});
  protected mode = signal<'columns' | 'overlay'>('columns');
  protected focusId = signal<string | null>(null);
  protected showSettings = signal(false);

  protected shown = computed(() => {
    const out = this.out(), ex = this.excluded();
    if (!out) return null;
    return { ...out, results: out.results.filter(r => r.isBaseline || !ex[r.id]) };
  });
  protected base = computed(() => this.out()?.results.find(r => r.isBaseline));
  protected ranked = computed(() => {
    const base = this.base();
    return (this.shown()?.results ?? []).filter(r => !r.isBaseline).map(r => ({ r, net: r.revenue - (base?.revenue ?? 0) - r.totalCost })).sort((a, b) => b.net - a.net);
  });
  protected best = computed(() => this.ranked().at(0));
  protected focus = computed(() => { const sh = this.shown(); return sh?.results.find(r => r.id === (this.focusId() ?? this.best()?.r.id)) ?? sh?.results[0]; });
  // Map : pas de find() par carte, barre ou colonne
  private colors = computed(() => new Map(this.strategies().map(s => [s.id, s.color])));
  protected color = (id: string) => this.colors().get(id) ?? '#64748B';
  protected haPerCell = computed(() => this.economics().cellAreaM2 / 10000);
  protected cherryHa = computed(() => this.parcels().filter(p => isCherry(p.type)).reduce((a, p) => a + p.area, 0) * this.haPerCell());
  protected climateLabel = computed(() => CLIMATE_LABEL[this.simParams().climateProfile]);
  protected shownStrategies = computed(() => { const sh = this.shown(); return this.strategies().filter(s => sh?.results.some(r => r.id === s.id)); });
  protected nonBaseline = computed(() => this.shown()?.results.filter(r => !r.isBaseline) ?? []);
  protected chips = computed<Chip[]>(() => {
    const ps = this.parcels(), sp = this.simParams(), eco = this.economics(), out = this.out(), cl = this.climateLabel();
    return [
      { icon: MapIcon, label: `${ps.length} parcelles · ${this.cherryHa().toFixed(2)} ha de cerisiers` },
      { icon: Clock, label: `${sp.durationYears} an${sp.durationYears > 1 ? 's' : ''} · départ ${sp.startSeason === 'spring' ? 'printemps' : 'automne'}` },
      { icon: IconClimate, label: out?.climate ? `${cl} · ${Math.round(out.climate.tMin)} → ${Math.round(out.climate.tMax)} °C · ${out.climate.degreeDays.toLocaleString('fr-FR')} DJ` : cl },
      { icon: Euro, label: `${eco.yieldTPerHa} t/ha · ${eco.pricePerKg.toFixed(2)} €/kg` },
    ];
  });

  constructor() {
    injectShareHydration();
    // impression automatique (?print=1)
    effect(() => {
      if (!this.out()) return;
      const p = new URLSearchParams(window.location.search);
      if (p.get('print') === '1') {
        p.delete('print');
        window.history.replaceState(window.history.state, '', window.location.pathname);
        setTimeout(() => window.print(), 600);
      }
    });
  }

  protected modeBtn(active: boolean) {
    return cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all', active ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900');
  }
  protected toggleExcluded(id: string) { this.excluded.update(e => ({ ...e, [id]: !e[id] })); }
  protected loadDemo() { gridStore.getState().loadDemo(); }
  protected print() { window.print(); }

  protected exportCsv() {
    const out = this.out();
    if (!out) return;
    const parcels = this.parcels(), base = this.base();
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
    download(`drososim-series-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
    toast('Séries temporelles exportées (.csv)');
  }
}
