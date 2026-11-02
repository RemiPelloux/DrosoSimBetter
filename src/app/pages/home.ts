import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { inView, scroll } from 'framer-motion/dom';
import {
  ArrowRight, PlayCircle, Paintbrush, SlidersHorizontal, BarChart3, Share2, Tractor, Users, FlaskConical,
  Check, X, Sparkles, MousePointerClick, Timer, Trophy, Leaf, BookOpen, Zap, type IconNode,
} from 'lucide';
import { gridStore, select, buildTemplate } from '@/lib/store';
import { simulate, detectParcels, defaultLeverConfig, isCherry, type LeverConfig, type StrategyResult } from '@/lib/engine';
import { Logo, FlyingFlies, Drosophila, CherryArt, LifeCycleDiagram } from '@/components/illustrations';
import { CountUp, Grain, Contours, IsoOrchard, HillsBackdrop, RingGauge, Sparkline } from '@/components/art';
import { IconNet, IconFly } from '@/components/icons';
import { Lucide } from '@/components/ui/lucide';
import { Motion, LayoutId, motionAnimate } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

// --------------------------------------------------------------- Démo réelle (calculée par le moteur)
const DEMO_GRID = buildTemplate('mixed');
function demoRun() {
  const parcels = detectParcels(DEMO_GRID);
  const lv = (o: Partial<LeverConfig>) => ({ ...defaultLeverConfig, ...o });
  const pbi: Record<string, LeverConfig> = {};
  parcels.forEach(p => {
    if (isCherry(p.type)) pbi[p.id] = lv({ prophylaxis: true, netting: p.type === 'late-cherry', tis: p.type !== 'late-cherry' });
    else pbi[p.id] = lv({ parasitoids: true });
  });
  const out = simulate(DEMO_GRID, parcels, [
    { id: 'base', name: 'Sans protection', isBaseline: true, leversByParcel: {} },
    { id: 'pbi', name: 'Protection intégrée', isBaseline: false, leversByParcel: pbi },
  ], { startSeason: 'spring', durationYears: 2, climateProfile: 'mild-winter' }, { yieldTPerHa: 10, pricePerKg: 3.5, cellAreaM2: 100 } as Parameters<typeof simulate>[4]);
  const [base, pbiR] = out.results;
  return { base, pbi: pbiR, max: Math.max(...Array.from(base.peakByCell), 1), ms: out.computeMs };
}
type Run = { base: StrategyResult; pbi: StrategyResult; max: number; ms: number };

// ======================================================================= Partenaires
const PARTNERS = [
  { name: 'République Française', desc: 'République Française', logo: '/partners/republique-francaise.png', link: 'https://www.info.gouv.fr/', w: 392, h: 342 },
  { name: 'INRAE', desc: "Institut national de recherche pour l'agriculture, l'alimentation et l'environnement — équipe M2P2, Sophia Antipolis", logo: '/partners/INRAE.png', link: 'https://inrae.fr', w: 300, h: 79 },
  { name: 'CTIFL', desc: 'Centre Technique Interprofessionnel des Fruits et Légumes', logo: '/partners/CTIFL.png', link: 'https://ctifl.fr', w: 470, h: 590 },
  { name: "Univ Côte d'Azur", desc: "Université Côte d'Azur", logo: '/partners/univ-cote-azur.png', link: 'https://univ-cotedazur.fr/', w: 400, h: 340 },
  { name: 'Ecophyto', desc: 'Plan Écophyto', logo: '/partners/Ecophyto.png', link: 'https://agriculture.gouv.fr/le-plan-ecophyto-quest-ce-que-cest', w: 960, h: 422 },
  { name: 'OFB', desc: 'Office Français de la Biodiversité', logo: '/partners/OFB.png', link: 'https://ofb.gouv.fr/', w: 464, h: 615 },
];

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];

// ======================================================================= Composants
@Component({
  selector: 'ds-home-section-title',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <div motion [initial]="{ opacity: 0, y: 18 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" [transition]="{ duration: 0.6 }" [class]="align() === 'center' ? 'text-center' : ''">
      <p [class]="cn('flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.3em]', align() === 'center' && 'justify-center', dark() ? 'text-emerald-300' : 'text-emerald-700')">
        <span class="font-display text-base italic tracking-normal">{{ n() }}</span><span [class]="cn('h-px w-8', dark() ? 'bg-emerald-300/50' : 'bg-emerald-700/40')"></span>{{ kicker() }}
      </p>
      <h2 [class]="cn('font-display mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-6xl', dark() ? 'text-white' : 'text-slate-900')"><ng-content /></h2>
    </div>
  `,
})
class SectionTitle {
  readonly n = input.required<string>();
  readonly kicker = input.required<string>();
  readonly align = input<'center' | 'left'>('center');
  readonly dark = input(false);
  protected cn = cn;
}

@Component({
  selector: 'ds-home-step-card',
  imports: [Motion, Lucide],
  host: { '[attr.title]': 'null', style: 'display: contents' },
  template: `
    <div motion [initial]="{ opacity: 0, y: 30 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" [transition]="{ delay: i() * 0.12 }" [whileHover]="{ y: -6 }"
      class="group relative overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_30px_60px_-35px_rgba(2,44,34,.3)]">
      <div class="relative h-52 overflow-hidden bg-gradient-to-br from-[#F3EEDF] to-emerald-50"><ng-content /></div>
      <div class="p-7">
        <div class="flex items-center gap-3">
          <span class="font-display text-4xl font-black italic text-emerald-700/20">0{{ i() + 1 }}</span>
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><svg [lucide]="icon()" class="h-5 w-5"></svg></span>
          <h3 class="font-display text-2xl font-semibold">{{ title() }}</h3>
        </div>
        <p class="mt-4 text-sm leading-relaxed text-slate-600">{{ text() }}</p>
      </div>
    </div>
  `,
})
class StepCard {
  readonly i = input.required<number>();
  readonly icon = input.required<IconNode>();
  readonly title = input.required<string>();
  readonly text = input.required<string>();
}

/** Mini-animation : la grille se peint toute seule */
@Component({
  selector: 'ds-home-paint-art',
  imports: [Motion, Lucide],
  host: { style: 'display: contents' },
  template: `
    <div class="absolute inset-0 flex items-center justify-center">
      <div #grid class="grid h-40 w-40 rotate-[-6deg] overflow-hidden rounded-xl shadow-xl ring-4 ring-white" style="grid-template-columns: repeat(20,1fr)">
        @for (t of g; track $index) { <div style="background-color: #EDE7D6"></div> }
      </div>
      <div motion class="absolute" [initial]="{ x: -60, y: 50 }" [whileInView]="{ x: 60, y: -40 }" [viewport]="{ once: true }" [transition]="{ duration: 1.6, delay: 0.3, ease: 'easeInOut' }">
        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl"><svg [lucide]="I.Paintbrush" class="h-5 w-5"></svg></span>
      </div>
    </div>
  `,
})
class PaintArt {
  protected g = buildTemplate('enclosed');
  protected I = { Paintbrush };
  private grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  constructor() {
    const COL: Record<string, string> = { neutral: '#EDE7D6', forest: '#2F6B3A', 'early-cherry': '#D97706', 'season-cherry': '#E11D48', 'late-cherry': '#991B1B' };
    let stop: VoidFunction | undefined;
    // un seul observateur pour les 400 cases (équivalent de whileInView once sur chaque case)
    afterNextRender(() => {
      const el = this.grid().nativeElement;
      stop = inView(el, () => {
        Array.from(el.children).forEach((c, k) => motionAnimate(c, { backgroundColor: COL[this.g[k]] }, { delay: 0.3 + ((k % 20) + Math.floor(k / 20)) * 0.035, duration: 0.25 }, { backgroundColor: '#EDE7D6' }));
        stop?.();
      });
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }
}

/** Mini-animation : interrupteurs de leviers */
@Component({
  selector: 'ds-home-lever-art',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <div class="absolute inset-0 flex flex-col justify-center gap-2.5 px-10">
      @for (it of items; track it[0]; let k = $index) {
        <div motion [initial]="{ opacity: 0, x: -20 }" [whileInView]="{ opacity: 1, x: 0 }" [viewport]="{ once: true }" [transition]="{ delay: 0.15 * k }"
          class="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
          <span class="text-sm font-semibold text-slate-700">{{ it[0] }}</span>
          <span class="relative h-5 w-9 rounded-full bg-slate-200">
            <span motion class="absolute inset-0 rounded-full" [style.background-color]="it[1]" [initial]="{ opacity: 0 }" [whileInView]="{ opacity: k === 2 ? 0 : 1 }" [viewport]="{ once: true }" [transition]="{ delay: 0.6 + 0.2 * k }"></span>
            <span motion class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow" [initial]="{ left: 2 }" [whileInView]="{ left: k === 2 ? 2 : 18 }" [viewport]="{ once: true }" [transition]="{ delay: 0.6 + 0.2 * k, type: 'spring', stiffness: 400, damping: 25 }"></span>
          </span>
        </div>
      }
    </div>
  `,
})
class LeverArt {
  protected items = [['Filet', '#2563EB'], ['Prophylaxie', '#0D9488'], ['Parasitoïdes', '#7C3AED'], ['TIS', '#DB2777']];
}

/** Mini-animation : courbes témoin vs stratégie */
@Component({
  selector: 'ds-home-decide-art',
  imports: [Sparkline, Lucide],
  host: { style: 'display: contents' },
  template: `
    <div class="absolute inset-0 flex flex-col justify-center gap-2 px-8">
      <div class="flex items-center justify-between text-[11px] font-bold"><span class="text-rose-600">● Sans protection</span><span class="text-emerald-700">● Protection intégrée</span></div>
      <div class="relative h-28 rounded-xl bg-white p-2 shadow-sm">
        <ds-sparkline [data]="a()" [max]="max()" color="#E11D48" [width]="300" [height]="96" className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" />
        <ds-sparkline [data]="b()" [max]="max()" color="#10B981" [width]="300" [height]="96" className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" />
      </div>
      <div class="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white">
        <svg [lucide]="I.Trophy" class="h-4 w-4 text-amber-300"></svg><span class="text-xs font-bold">Protection intégrée</span>
        <span class="font-display ml-auto text-sm">{{ run().pbi.globalHarvest.toFixed(0) }} % récolte</span>
      </div>
    </div>
  `,
})
class DecideArt {
  readonly run = input.required<Run>();
  protected I = { Trophy };
  protected a = computed(() => this.run().base.series.map(p => Number(p['cherry_all']) || 0));
  protected b = computed(() => this.run().pbi.series.map(p => Number(p['cherry_all']) || 0));
  protected max = computed(() => Math.max(...this.a(), ...this.b(), 1));
}

/** Aperçu stylisé de la page de résultats */
@Component({
  selector: 'ds-home-verdict-preview',
  imports: [Motion, Lucide],
  host: { style: 'display: contents' },
  template: `
    <div motion [initial]="{ opacity: 0, y: 30, rotate: 2 }" [whileInView]="{ opacity: 1, y: 0, rotate: 0 }" [viewport]="{ once: true }" [transition]="{ duration: 0.8, ease: ease }" class="relative">
      <div class="overflow-hidden rounded-[32px] bg-[#03241C] p-7 text-white shadow-[0_50px_100px_-40px_rgba(2,44,34,.6)]">
        <p class="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-300"><svg [lucide]="I.Trophy" class="h-3.5 w-3.5"></svg> Verdict</p>
        <p class="font-display mt-2 text-4xl font-semibold">Protection <em class="text-emerald-300">intégrée</em></p>
        <div class="mt-6 grid grid-cols-3 gap-3">
          @for (s of stats(); track s[1]) {
            <div class="rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10"><p class="font-display text-2xl font-semibold">{{ s[0] }}</p><p class="text-[10px] uppercase tracking-wider text-emerald-200/60">{{ s[1] }}</p></div>
          }
        </div>
      </div>
      <div motion [initial]="{ opacity: 0, x: 30 }" [whileInView]="{ opacity: 1, x: 0 }" [viewport]="{ once: true }" [transition]="{ delay: 0.3 }"
        class="relative -mt-8 ml-10 rounded-[28px] border border-white bg-white p-5 shadow-2xl">
        <p class="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Récolte saine par parcelle</p>
        <div class="flex h-32 items-stretch gap-5">
          @for (pid of pids(); track pid) {
            <div class="flex h-full flex-1 items-end justify-center gap-2">
              @for (v of [run().base.harvestByParcel[pid], run().pbi.harvestByParcel[pid]]; track $index; let k = $index) {
                <div class="flex h-full w-6 flex-col justify-end">
                  <span [class]="cn('mb-1 text-center text-[9px] font-bold', k ? 'text-emerald-700' : 'text-slate-400')">{{ round(v) }}%</span>
                  <div motion [class]="cn('w-full rounded-t-md', k === 0 ? 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_3px,#94A3B8_3px_6px)]' : 'bg-gradient-to-t from-emerald-600 to-emerald-400')"
                    [initial]="{ height: 0 }" [whileInView]="{ height: barHeight(v) }" [viewport]="{ once: true }" [transition]="{ delay: 0.5 + k * 0.12, duration: 0.9, ease: ease }"></div>
                </div>
              }
            </div>
          }
        </div>
        <div class="mt-2 flex justify-around text-[10px] font-semibold text-slate-500"><span>Précoce</span><span>Tardive</span><span>Saison</span></div>
        <div class="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500"><span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-[repeating-linear-gradient(45deg,#CBD5E1_0_2px,#94A3B8_2px_4px)]"></span>Sans protection</span><span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-500"></span>Protection intégrée</span></div>
      </div>
      <div motion [initial]="{ opacity: 0, scale: 0.8 }" [whileInView]="{ opacity: 1, scale: 1 }" [viewport]="{ once: true }" [transition]="{ delay: 0.6 }"
        class="absolute -right-3 -top-5 flex items-center gap-2 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-black text-amber-950 shadow-xl">
        <svg [lucide]="I.Trophy" class="h-4 w-4"></svg> +{{ (run().pbi.globalHarvest - run().base.globalHarvest).toFixed(0) }} pts vs témoin
      </div>
    </div>
  `,
})
class VerdictPreview {
  readonly run = input.required<Run>();
  protected I = { Trophy };
  protected cn = cn;
  protected ease = EASE_OUT_EXPO;
  protected pids = computed(() => Object.keys(this.run().base.harvestByParcel));
  protected stats = computed(() => {
    const r = this.run();
    const gain = r.pbi.revenue - r.base.revenue - r.pbi.totalCost;
    return [[`${r.pbi.globalHarvest.toFixed(0)} %`, 'récolte'], [`+${(gain / 1000).toFixed(1)} k€`, 'bilan / an'], [`${r.pbi.ift.toFixed(1)}`, 'IFT']];
  });
  protected round = (v: number) => Math.round(Number(v));
  protected barHeight = (v: number) => `${Math.max(2, Number(v) * 0.8)}%`;
}

@Component({
  selector: 'ds-home-hero-orchard',
  imports: [Motion, LayoutId, IsoOrchard, RingGauge],
  host: { style: 'display: contents' },
  template: `
    <div motion [initial]="{ opacity: 0, scale: 0.9, rotateX: 25 }" [animate]="{ opacity: 1, scale: 1, rotateX: 0 }" [transition]="{ duration: 1.2, delay: 0.2, ease: ease }" class="relative">
      <div class="absolute inset-x-12 bottom-8 h-20 rounded-full bg-black/45 blur-3xl"></div>
      <div motion [animate]="{ y: [0, -8, 0] }" [transition]="{ duration: 6, repeat: inf, ease: 'easeInOut' }">
        <ds-iso-orchard [grid]="grid" [heat]="r().peakByCell" [max]="run().max" className="relative w-full drop-shadow-2xl" />
      </div>
      <div class="absolute left-1/2 top-0 flex -translate-x-1/2 rounded-full bg-black/35 p-1 ring-1 ring-white/15 backdrop-blur">
        @for (v of views; track v) {
          <button (click)="pick(v)" [class]="cn('relative rounded-full px-4 py-1.5 text-xs font-bold transition-colors', view() === v ? 'text-slate-900' : 'text-white/70 hover:text-white')">
            @if (view() === v) { <span layoutId="heroToggle" [layoutTransition]="{ type: 'spring', stiffness: 400, damping: 30 }" class="absolute inset-0 rounded-full bg-white"></span> }
            <span class="relative">{{ v === 'base' ? 'Sans protection' : 'Protection intégrée' }}</span>
          </button>
        }
      </div>
      @for (v of [shown()]; track v) {
        <div #card motion [initial]="{ opacity: 0, x: 20 }" [animate]="{ opacity: 1, x: 0 }" [transition]="{ duration: 0.35 }"
          class="absolute -left-2 bottom-10 w-56 rounded-2xl bg-white/95 p-4 text-slate-900 shadow-2xl md:-left-8">
          <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{{ v === 'base' ? 'Sans protection' : 'Protection intégrée' }}</p>
          <div class="mt-2 flex items-center gap-3">
            <ds-ring-gauge [value]="shownR().globalHarvest" [size]="64" [stroke]="7" [color]="v === 'base' ? '#E11D48' : '#10B981'">
              <span class="font-display text-lg font-semibold">{{ shownR().globalHarvest.toFixed(0) }}</span>
            </ds-ring-gauge>
            <div>
              <p class="text-[11px] text-slate-500">de récolte saine</p>
              @if (v === 'pbi') { <p class="font-display text-xl font-semibold text-emerald-700">+{{ (gain() / 1000).toFixed(1) }} k€<span class="text-xs font-normal text-slate-500"> /an</span></p> }
              @else { <p class="font-display text-xl font-semibold text-rose-600">{{ (run().base.peakDensity / 1000).toFixed(0) }} k<span class="text-xs font-normal text-slate-500"> ♀/ha</span></p> }
            </div>
          </div>
        </div>
      }
      <div class="absolute bottom-3 right-2 flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/80 ring-1 ring-white/10 backdrop-blur">
        Pression <span class="h-2 w-20 rounded-full" style="background: linear-gradient(90deg,#FEF08A,#F97316,#BE123C)"></span>
      </div>
      <p class="absolute -bottom-6 right-2 text-[10px] text-emerald-100/50">Calcul réel du moteur · verger de démonstration · 2 ans</p>
    </div>
  `,
})
class HeroOrchard {
  readonly run = input.required<Run>();
  protected grid = DEMO_GRID;
  protected cn = cn;
  protected ease = EASE_OUT_EXPO;
  protected inf = Infinity;
  protected views = ['base', 'pbi'] as const;
  protected view = signal<'base' | 'pbi'>('base');
  /** Carte affichée : suit `view` après l'animation de sortie (AnimatePresence mode="wait") */
  protected shown = signal<'base' | 'pbi'>('base');
  private auto = signal(true);
  private card = viewChild<ElementRef<HTMLElement>>('card');
  protected r = computed(() => (this.view() === 'base' ? this.run().base : this.run().pbi));
  protected shownR = computed(() => (this.shown() === 'base' ? this.run().base : this.run().pbi));
  protected gain = computed(() => this.run().pbi.revenue - this.run().base.revenue - this.run().pbi.totalCost);
  private exitToken = 0;

  constructor() {
    effect(onCleanup => {
      if (!this.auto()) return;
      const t = setInterval(() => this.view.update(v => (v === 'base' ? 'pbi' : 'base')), 3800);
      onCleanup(() => clearInterval(t));
    });
    // sortie de l'ancienne carte, puis entrée de la nouvelle
    effect(() => {
      const v = this.view();
      if (v === this.shown()) return;
      const token = ++this.exitToken;
      const el = this.card()?.nativeElement;
      const done = () => { if (token === this.exitToken) this.shown.set(this.view()); };
      if (!el) { done(); return; }
      motionAnimate(el, { opacity: 0, x: -10 }, { duration: 0.35 }).then(done, done);
    });
  }

  protected pick(v: 'base' | 'pbi') { this.auto.set(false); this.view.set(v); }
}

// ======================================================================= Page
@Component({
  selector: 'ds-home-page',
  imports: [
    RouterLink, Motion, Lucide, Logo, FlyingFlies, Drosophila, CherryArt, LifeCycleDiagram,
    CountUp, Grain, Contours, IsoOrchard, HillsBackdrop, IconNet, IconFly,
    SectionTitle, StepCard, PaintArt, LeverArt, DecideArt, VerdictPreview, HeroOrchard,
  ],
  host: { style: 'display: contents' },
  template: `
    <div class="min-h-screen overflow-x-hidden bg-[#F6F4EE] text-slate-900">
      <!-- ================================================================ HERO -->
      <section class="relative min-h-[100svh] overflow-hidden bg-[#03241C] text-white">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(16,185,129,.38),transparent_55%),radial-gradient(ellipse_at_90%_80%,rgba(244,63,94,.2),transparent_50%)]"></div>
        <ds-contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
        <ds-grain [opacity]="0.13" />
        <ds-flying-flies [count]="5" className="opacity-60" />

        <nav class="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a routerLink="/" class="flex items-center gap-2.5"><ds-logo [size]="40" /><span class="text-xl font-extrabold tracking-tight">DrosoSim<span class="text-emerald-300">Next</span></span></a>
          <div class="flex items-center gap-1">
            @for (l of navLinks; track l[0]) {
              <a [href]="l[0]" (click)="anchor($event, l[0])" class="hidden rounded-full px-4 py-2 text-sm font-semibold text-emerald-50/80 hover:bg-white/10 hover:text-white md:block">{{ l[1] }}</a>
            }
            <a routerLink="/docs/presentation" class="hidden rounded-full px-4 py-2 text-sm font-semibold text-emerald-50/80 hover:bg-white/10 hover:text-white md:block">Documentation</a>
            <button (click)="start()" class="ml-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg hover:bg-emerald-50">Ouvrir le simulateur</button>
          </div>
        </nav>

        <div #hero style="transform: none; opacity: 1" class="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-6 pb-40 pt-6 lg:grid-cols-[1fr_1.1fr] lg:pt-12">
          <div>
            <span motion [initial]="{ opacity: 0, y: 10 }" [animate]="{ opacity: 1, y: 0 }" class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-emerald-100 ring-1 ring-white/15 backdrop-blur">
              <svg [lucide]="I.Sparkles" class="h-3.5 w-3.5 text-amber-300"></svg> Protection intégrée contre <em class="font-display text-sm">Drosophila suzukii</em>
            </span>
            <h1 class="font-display mt-7 text-[56px] font-semibold leading-[0.98] tracking-tight md:text-[84px]">
              @for (w of ['Le verger,', 'simulé.']; track w; let i = $index) {
                <span motion [class]="cn('block', i === 1 && 'italic text-emerald-300')" [initial]="{ opacity: 0, y: 40, rotateX: 40 }" [animate]="{ opacity: 1, y: 0, rotateX: 0 }" [transition]="{ delay: 0.1 + i * 0.12, duration: 0.8, ease: ease }">{{ w }}</span>
              }
              @for (w of ['La décision,', 'éclairée.']; track w; let i = $index) {
                <span motion [class]="cn('block', i === 1 && 'bg-gradient-to-r from-amber-200 to-rose-300 bg-clip-text italic text-transparent')" [initial]="{ opacity: 0, y: 40, rotateX: 40 }" [animate]="{ opacity: 1, y: 0, rotateX: 0 }" [transition]="{ delay: 0.34 + i * 0.12, duration: 0.8, ease: ease }">{{ w }}</span>
              }
            </h1>
            <p motion [initial]="{ opacity: 0 }" [animate]="{ opacity: 1 }" [transition]="{ delay: 0.7 }" class="mt-7 max-w-lg text-lg leading-relaxed text-emerald-50/75">
              Dessinez votre parcellaire en 10 secondes, combinez filets, prophylaxie, biocontrôle, parasitoïdes ou TIS, et lisez instantanément l'impact sur la récolte, le revenu et l'IFT.
            </p>
            <div motion [initial]="{ opacity: 0, y: 10 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 0.85 }" class="mt-9 flex flex-wrap gap-3">
              <button (click)="start()" class="group flex h-14 items-center gap-2 rounded-2xl bg-white px-7 text-base font-bold text-slate-900 shadow-2xl shadow-emerald-950/40 transition-transform hover:-translate-y-0.5">
                {{ hasProject() ? 'Reprendre mon verger' : 'Dessiner mon verger' }} <svg [lucide]="I.ArrowRight" class="h-5 w-5 transition-transform group-hover:translate-x-1"></svg>
              </button>
              <button (click)="demo()" class="flex h-14 items-center gap-2 rounded-2xl bg-white/10 px-6 text-base font-bold ring-1 ring-white/25 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15">
                <svg [lucide]="I.PlayCircle" class="h-5 w-5 text-emerald-300"></svg> Voir la démo
              </button>
            </div>
            <div motion [initial]="{ opacity: 0 }" [animate]="{ opacity: 1 }" [transition]="{ delay: 1 }" class="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-emerald-50/70">
              <span class="flex items-center gap-2"><svg [lucide]="I.Timer" class="h-4 w-4 text-emerald-300"></svg>Calcul en quelques ms</span>
              <span class="flex items-center gap-2"><svg [lucide]="I.MousePointerClick" class="h-4 w-4 text-emerald-300"></svg>Sans compte</span>
              <span class="flex items-center gap-2"><svg [lucide]="I.Share2" class="h-4 w-4 text-emerald-300"></svg>Partage par lien</span>
            </div>
            <div motion [initial]="{ opacity: 0, y: 10 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 1.15 }" class="mt-8">
              <p class="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-200/60">Avec la recherche et la filière</p>
              <div class="mt-3 flex flex-wrap items-center gap-1.5 lg:flex-nowrap">
                @for (p of partners; track p.name; let i = $index) {
                  <a motion [href]="p.link" target="_blank" rel="noopener noreferrer" [title]="p.desc"
                    [initial]="{ opacity: 0, y: 8 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: 1.2 + i * 0.06 }" [whileHover]="{ y: -3 }"
                    class="flex h-12 w-[74px] items-center justify-center rounded-xl bg-white/95 px-2 py-1.5 shadow-lg shadow-black/20 ring-1 ring-white/20 transition-colors hover:bg-white">
                    <img [src]="p.logo" [alt]="p.name" [width]="p.w" [height]="p.h" loading="lazy" decoding="async" style="color: transparent" class="max-h-9 w-auto max-w-full object-contain" />
                  </a>
                }
              </div>
            </div>
          </div>

          <ds-home-hero-orchard [run]="run" />
        </div>

        <ds-hills-backdrop className="absolute inset-x-0 bottom-0 h-44 w-full" />
        <a motion href="#chiffres" (click)="anchor($event, '#chiffres')" [animate]="{ y: [0, 8, 0] }" [transition]="{ duration: 2, repeat: inf }" class="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-200/70">Découvrir ↓</a>
      </section>

      <!-- ================================================================ CHIFFRES -->
      <section id="chiffres" class="relative border-b border-slate-200/70 bg-white">
        <div class="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-100 md:grid-cols-4">
          @for (k of kpis; track k.l; let i = $index) {
            <div motion [initial]="{ opacity: 0, y: 16 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" [transition]="{ delay: i * 0.08 }" class="px-6 py-10 text-center">
              <p class="font-display text-5xl font-semibold text-slate-900 md:text-6xl"><ds-count-up [value]="k.v" [suffix]="k.s" [signed]="k.plus" /></p>
              <p class="mt-2 text-sm font-medium text-slate-500">{{ k.l }}</p>
            </div>
          }
        </div>
      </section>

      <!-- ================================================================ 3 GESTES -->
      <section id="fonctionnement" class="relative mx-auto max-w-7xl px-6 py-28">
        <ds-home-section-title n="01" kicker="En trois gestes">Du dessin à la <em class="text-emerald-700">décision</em></ds-home-section-title>
        <div class="mt-14 grid gap-6 md:grid-cols-3">
          <ds-home-step-card [i]="0" [icon]="I.Paintbrush" [title]="'Dessinez'" [text]="'Pinceau, zone, remplissage, gomme au clic droit et modèles prêts à l\\'emploi. Les parcelles se forment et se nomment toutes seules.'"><ds-home-paint-art /></ds-home-step-card>
          <ds-home-step-card [i]="1" [icon]="I.SlidersHorizontal" [title]="'Combinez'" [text]="'Cinq leviers par parcelle, réglages fins, « Appliquer à toutes » en un clic. Climat, durée, hypothèses économiques.'"><ds-home-lever-art /></ds-home-step-card>
          <ds-home-step-card [i]="2" [icon]="I.BarChart3" [title]="'Décidez'" [text]="'Verdict, classement, courbes légendées, carte de pression, bilan en euros et Fiche Conseil PDF à partager.'"><ds-home-decide-art [run]="run" /></ds-home-step-card>
        </div>
      </section>

      <!-- ================================================================ APERÇU VERDICT -->
      <section class="relative overflow-hidden bg-white py-28">
        <div class="absolute -left-40 top-20 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl"></div>
        <div class="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl"></div>
        <div class="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2">
          <div>
            <ds-home-section-title n="02" kicker="Lisible en un coup d'œil" align="left">Des résultats qui <em class="text-emerald-700">parlent</em> au verger</ds-home-section-title>
            <p class="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">Fini les courbes muettes : chaque graphique est légendé, chaque levier chiffré. Le témoin sans protection est toujours calculé pour mesurer le gain réel.</p>
            <ul class="mt-8 space-y-3">
              @for (t of bullets; track t) {
                <li class="flex items-center gap-3 text-slate-700"><span class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><svg [lucide]="I.Check" class="h-3.5 w-3.5"></svg></span>{{ t }}</li>
              }
            </ul>
            <button (click)="demo()" class="mt-10 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-bold text-white hover:bg-slate-800"><svg [lucide]="I.PlayCircle" class="h-5 w-5"></svg> Explorer les résultats de la démo</button>
          </div>
          <ds-home-verdict-preview [run]="run" />
        </div>
      </section>

      <!-- ================================================================ MODÈLE -->
      <section id="modele" class="relative mx-auto max-w-7xl px-6 py-28">
        <div class="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <ds-home-section-title n="03" kicker="Sous le capot" align="left">Un modèle biologique <em class="text-emerald-700">transparent</em></ds-home-section-title>
            <p class="mt-6 text-lg leading-relaxed text-slate-600">Chaque jour, sur 400 cases : température, ponte selon la maturité des fruits, développement en degrés-jours, mortalité, dispersion vers les vergers attractifs. Chaque stratégie est simulée intégralement.</p>
            <div class="mt-8 grid grid-cols-2 gap-3">
              <div class="ico-host flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><svg [lucide]="I.BookOpen" class="h-5 w-5 text-emerald-700"></svg><span class="text-sm font-semibold text-slate-700">Équations documentées</span></div>
              <div class="ico-host flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><ds-icon-net className="h-5 w-5 text-emerald-700" /><span class="text-sm font-semibold text-slate-700">Effet de chaque levier</span></div>
              <div class="ico-host flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><svg [lucide]="I.Leaf" class="h-5 w-5 text-emerald-700"></svg><span class="text-sm font-semibold text-slate-700">Économie détaillée</span></div>
              <div class="ico-host flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><ds-icon-fly className="h-5 w-5 text-emerald-700" /><span class="text-sm font-semibold text-slate-700">Limites assumées</span></div>
            </div>
            <div class="mt-8 flex items-center gap-5">
              <a routerLink="/docs/modele" class="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 font-bold text-white hover:bg-emerald-800">Lire la documentation <svg [lucide]="I.ArrowRight" class="h-4 w-4"></svg></a>
              <ds-cherry-art [size]="46" />
              <div motion [animate]="{ x: [0, 10, -6, 0], y: [0, -6, 4, 0] }" [transition]="{ duration: 3, repeat: inf }"><ds-drosophila [size]="46" /></div>
            </div>
          </div>
          <div motion [initial]="{ opacity: 0, scale: 0.95 }" [whileInView]="{ opacity: 1, scale: 1 }" [viewport]="{ once: true }" class="rounded-[32px] border border-white bg-white p-6 shadow-[0_40px_80px_-40px_rgba(2,44,34,.35)]">
            <ds-life-cycle-diagram />
          </div>
        </div>
      </section>

      <!-- ================================================================ PERSONAS -->
      <section class="relative bg-[#03241C] py-28 text-white">
        <ds-contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
        <ds-grain [opacity]="0.12" />
        <div class="relative mx-auto max-w-7xl px-6">
          <ds-home-section-title n="04" kicker="Pour qui ?" [dark]="true">Conçu pour le <em class="text-amber-200">terrain</em></ds-home-section-title>
          <div class="mt-14 grid gap-5 md:grid-cols-3">
            @for (p of personas; track p.t; let k = $index) {
              <div motion [initial]="{ opacity: 0, y: 24 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" [transition]="{ delay: k * 0.1 }"
                class="rounded-[28px] bg-white/[.06] p-7 ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/[.09]">
                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20"><svg [lucide]="p.i" class="h-6 w-6"></svg></span>
                <h3 class="mt-5 text-xl font-bold">{{ p.t }}</h3>
                <p class="font-display mt-3 text-lg italic leading-snug text-emerald-50/90">{{ p.q }}</p>
                <p class="mt-3 text-sm text-emerald-50/60">{{ p.d }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ================================================================ COMPARATIF -->
      <section id="pourquoi" class="mx-auto max-w-5xl px-6 py-28">
        <ds-home-section-title n="05" kicker="Pourquoi une nouvelle plateforme ?">Tout ce qui manquait, <em class="text-emerald-700">enfin réuni</em></ds-home-section-title>
        <div motion [initial]="{ opacity: 0, y: 20 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" class="mt-12 overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_30px_60px_-35px_rgba(2,44,34,.3)]">
          <div class="grid grid-cols-[1fr_1.2fr_1.5fr] gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500"><span></span><span>Avant</span><span class="text-emerald-700">DrosoSim Next</span></div>
          @for (row of compare; track row[0]; let i = $index) {
            <div motion [initial]="{ opacity: 0, x: -10 }" [whileInView]="{ opacity: 1, x: 0 }" [viewport]="{ once: true }" [transition]="{ delay: i * 0.05 }"
              class="grid grid-cols-[1fr_1.2fr_1.5fr] items-center gap-4 border-b border-slate-50 px-6 py-4 text-sm last:border-0">
              <span class="font-bold text-slate-800">{{ row[0] }}</span>
              <span class="flex items-center gap-2 text-slate-400"><svg [lucide]="I.X" class="h-4 w-4 shrink-0 text-rose-300"></svg>{{ row[1] }}</span>
              <span class="flex items-center gap-2 font-semibold text-slate-800"><svg [lucide]="I.Check" class="h-4 w-4 shrink-0 text-emerald-600"></svg>{{ row[2] }}</span>
            </div>
          }
        </div>
      </section>

      <!-- ================================================================ CTA -->
      <section class="mx-auto max-w-7xl px-6 pb-24">
        <div motion [initial]="{ opacity: 0, y: 30 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }"
          class="relative overflow-hidden rounded-[40px] bg-[#03241C] px-8 py-16 text-white shadow-2xl md:px-16">
          <ds-contours className="absolute inset-0 h-full w-full" color="#FCD34D" />
          <ds-grain [opacity]="0.12" />
          <ds-flying-flies [count]="3" className="opacity-60" />
          <div class="relative grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 class="font-display text-5xl font-semibold leading-tight md:text-6xl">Prêt à protéger votre <em class="text-amber-200">récolte</em> ?</h2>
              <p class="mt-4 max-w-lg text-lg text-emerald-50/70">Gratuit, sans inscription. Vos données restent dans votre navigateur.</p>
              <div class="mt-8 flex flex-wrap gap-3">
                <button (click)="start()" class="flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-slate-900 hover:bg-emerald-50"><svg [lucide]="I.Zap" class="h-5 w-5 text-emerald-700"></svg> Lancer le simulateur</button>
                <button (click)="demo()" class="flex items-center gap-2 rounded-2xl px-7 py-4 font-bold ring-1 ring-white/30 hover:bg-white/10"><svg [lucide]="I.PlayCircle" class="h-5 w-5"></svg> Voir la démo</button>
              </div>
            </div>
            <div class="hidden md:block"><ds-iso-orchard [grid]="grid" [heat]="run.pbi.peakByCell" [max]="run.max" className="w-full drop-shadow-2xl" [flies]="false" /></div>
          </div>
        </div>
      </section>

      <footer class="border-t border-slate-200 py-10">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 md:flex-row">
          <span class="flex items-center gap-2"><ds-logo [size]="24" [animated]="false" /> DrosoSim Next — outil pédagogique d'aide à la décision</span>
          <span class="flex items-center gap-4">
            @for (p of partners; track p.name) {
              <a [href]="p.link" target="_blank" rel="noopener noreferrer" [title]="p.desc" class="opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"><img [src]="p.logo" [alt]="p.name" [width]="p.w" [height]="p.h" loading="lazy" decoding="async" style="color: transparent" class="h-6 w-auto object-contain" /></a>
            }
          </span>
          <span class="flex gap-5"><a routerLink="/docs/presentation" class="hover:text-slate-900">Documentation</a><a routerLink="/docs/limites" class="hover:text-slate-900">Limites du modèle</a><a routerLink="/simulator" class="hover:text-slate-900">Simulateur</a></span>
        </div>
      </footer>
    </div>
  `,
})
export class HomePage {
  private router = inject(Router);
  protected cn = cn;
  protected ease = EASE_OUT_EXPO;
  protected inf = Infinity;
  protected grid = DEMO_GRID;
  protected run: Run = demoRun();
  protected hasProject = select(s => s.grid.some(c => c !== 'neutral'));
  protected partners = PARTNERS;
  protected I = { ArrowRight, PlayCircle, Paintbrush, SlidersHorizontal, BarChart3, Share2, Check, X, Sparkles, MousePointerClick, Timer, Leaf, BookOpen, Zap };
  protected navLinks = [['#fonctionnement', 'Fonctionnement'], ['#modele', 'Le modèle'], ['#pourquoi', 'Pourquoi']];
  protected kpis = [
    { v: 400, s: '', l: 'cases simulées chaque jour', d: 0, plus: false },
    { v: this.run.ms, s: ' ms', l: 'pour 2 stratégies sur 2 ans', d: 0, plus: false },
    { v: 5, s: '', l: 'leviers combinables', d: 0, plus: false },
    { v: this.run.pbi.globalHarvest - this.run.base.globalHarvest, s: ' pts', l: 'de récolte sauvée (démo)', d: 0, plus: true },
  ];
  protected bullets = ['Récolte préservée et gain en points vs témoin', 'Bilan net en euros, coûts éditables, ROI', 'Pic de pression, IFT chimique, heures de travail', 'Périodes de maturité et interventions sur les courbes'];
  protected personas = [
    { i: Tractor, t: 'Arboriculteur', q: '« Le filet sur ma tardive est-il rentable face au bois voisin ? »', d: 'Sur PC au bureau ou sur tablette au verger, lisible en plein soleil.' },
    { i: Users, t: 'Conseiller technique', q: '« Je compare trois scénarios en direct devant le producteur. »', d: 'Puis j’envoie un lien ou une Fiche Conseil PDF en un clic.' },
    { i: FlaskConical, t: 'Expérimentateur', q: '« Je veux voir les hypothèses et exporter les séries. »', d: 'Réglages fins, documentation complète, CSV et JSON.' },
  ];
  protected compare = [
    ['Saisie du verger', 'Glisser-déposer case par case', 'Pinceau, zone, remplissage, modèles'],
    ['Correction', 'Impossible, pas d’historique', 'Menu d’édition, gomme clic droit, Ctrl+Z'],
    ['Parcours', '3 écrans séparés', 'Cockpit unifié + aperçu temps réel'],
    ['Calcul', '≈ 0,7 s côté serveur', 'Quelques ms dans le navigateur'],
    ['Graphiques', 'Couleurs sans légende', 'Légendes, phénologie, interventions'],
    ['Décision', 'Aucun indicateur économique', 'Bilan net, ROI, IFT, radar multicritère'],
    ['Partage', 'Icônes mystérieuses', 'Lien, JSON, CSV, Fiche Conseil PDF'],
  ];
  private hero = viewChild.required<ElementRef<HTMLElement>>('hero');

  constructor() {
    // Parallaxe du hero : y 0 → 120 px sur 600 px de défilement, opacité 1 → 0,2 sur 500 px (useScroll + useTransform)
    let stop: VoidFunction | undefined;
    afterNextRender(() => {
      const el = this.hero().nativeElement;
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      stop = scroll((_: number, info: { y: { current: number } }) => {
        const y = info.y.current;
        const ty = 120 * clamp(y / 600);
        el.style.transform = ty ? `translateY(${ty}px)` : 'none';
        el.style.opacity = String(1 - 0.8 * clamp(y / 500));
      });
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }

  protected demo() { gridStore.getState().loadDemo(); gridStore.getState().setOnboardingDone(true); this.router.navigateByUrl('/results'); }
  protected start() { this.router.navigateByUrl('/simulator'); }

  /** Ancres internes (#…) : défilement doux sur la page, sans passer par le routeur (base href). */
  protected anchor(e: Event, hash: string) {
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(history.state, '', hash);
  }
}
