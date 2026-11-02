import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { animate, inView } from 'framer-motion/dom';
import type { CellType } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { Motion } from './ui/motion';

// =============================================================================
// Direction artistique — DrosoSim Next
// =============================================================================

/** Identifiants SVG uniques (équivalent de useId). */
let uidSeq = 0;
const uid = () => `a${++uidSeq}`;

/** Nombre qui « monte » à l'affichage (et se ré-anime quand la valeur change) */
@Component({
  selector: 'ds-count-up',
  host: { style: 'display: contents' },
  template: `<span #el [class]="cn('tabular-nums', className())">{{ zeroText() }}</span>`,
})
export class CountUp {
  readonly value = input.required<number>();
  readonly decimals = input(0);
  readonly prefix = input('');
  readonly suffix = input('');
  readonly className = input<string>();
  readonly duration = input(1.1);
  readonly signed = input(false);
  protected cn = cn;
  private el = viewChild.required<ElementRef<HTMLSpanElement>>('el');
  protected zeroText = computed(() => this.fmt(0));

  private fmt(v: number) {
    const d = this.decimals();
    const s = Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return `${this.signed() && v > 0 ? '+' : v < 0 ? '−' : ''}${this.prefix()}${s}${this.suffix()}`;
  }

  constructor() {
    let from = 0;
    let seen = false;
    let stopAnim: { stop: () => void } | undefined;
    let stopView: VoidFunction | undefined;
    const run = () => {
      const node = this.el().nativeElement;
      const value = this.value();
      stopAnim?.stop();
      stopAnim = animate(from, value, { duration: this.duration(), ease: [0.16, 1, 0.3, 1], onUpdate: v => { node.textContent = this.fmt(v); } });
      from = value;
    };
    afterNextRender(() => {
      const node = this.el().nativeElement;
      node.textContent = this.fmt(0);
      stopView = inView(node, () => { seen = true; stopView?.(); run(); }, { margin: '-20px' });
    });
    effect(() => {
      this.value();
      untracked(() => { if (seen) run(); });
    });
    inject(DestroyRef).onDestroy(() => { stopAnim?.stop(); stopView?.(); });
  }
}

/** Jauge circulaire animée */
@Component({
  selector: 'ds-ring-gauge',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <div class="relative shrink-0" [style.width.px]="size()" [style.height.px]="size()">
      <svg [attr.width]="size()" [attr.height]="size()" class="-rotate-90">
        <defs>
          <linearGradient [attr.id]="'g' + id" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.55" /><stop offset="100%" [attr.stop-color]="color()" /></linearGradient>
        </defs>
        <circle [attr.cx]="size() / 2" [attr.cy]="size() / 2" [attr.r]="r()" fill="none" [attr.stroke]="track()" [attr.stroke-width]="stroke()" />
        <circle motion [attr.cx]="size() / 2" [attr.cy]="size() / 2" [attr.r]="r()" fill="none" [attr.stroke]="'url(#g' + id + ')'" [attr.stroke-width]="stroke()" stroke-linecap="round"
          [attr.stroke-dasharray]="c()" [initial]="{ strokeDashoffset: c() }" [animate]="{ strokeDashoffset: c() * (1 - pct()) }" [transition]="{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }" />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center"><ng-content /></div>
    </div>
  `,
})
export class RingGauge {
  readonly value = input.required<number>();
  readonly max = input(100);
  readonly size = input(92);
  readonly stroke = input(9);
  readonly color = input('#10B981');
  readonly track = input('#E2E8F0');
  protected id = uid();
  protected r = computed(() => (this.size() - this.stroke()) / 2);
  protected c = computed(() => 2 * Math.PI * this.r());
  protected pct = computed(() => Math.max(0, Math.min(1, this.value() / this.max())));
}

/** Mini-courbe (sparkline) avec aire dégradée */
@Component({
  selector: 'ds-sparkline',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" [attr.class]="className() || null" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" preserveAspectRatio="none">
      <defs><linearGradient [attr.id]="'s' + id" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.35" /><stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" /></linearGradient></defs>
      <path [attr.d]="paths().area" [attr.fill]="'url(#s' + id + ')'" />
      <path motion [attr.d]="paths().line" fill="none" [attr.stroke]="color()" stroke-width="1.8" stroke-linejoin="round" [initial]="{ pathLength: 0 }" [animate]="{ pathLength: 1 }" [transition]="{ duration: 1.4, ease: 'easeOut' }" />
    </svg>
  `,
})
export class Sparkline {
  readonly data = input.required<number[]>();
  readonly color = input('#10B981');
  readonly width = input(140);
  readonly height = input(36);
  readonly className = input<string>();
  readonly max = input<number>();
  protected id = uid();
  protected paths = computed(() => {
    const data = this.data(), width = this.width(), height = this.height();
    if (!data.length) return { line: '', area: '' };
    const max = this.max() ?? Math.max(...data, 1);
    const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * width, height - 2 - (v / max) * (height - 4)]);
    const l = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { line: l, area: `${l} L${width} ${height} L0 ${height} Z` };
  });
}

/**
 * En-tête de chapitre éditorial.
 * Titre simple : [title]="'…'" ; titre riche : contenu projeté avec l'attribut `chapterTitle`.
 */
@Component({
  selector: 'ds-chapter',
  imports: [Motion],
  host: { '[attr.title]': 'null', '[attr.id]': 'null', style: 'display: contents' },
  template: `
    <section [id]="id()" [class]="cn('scroll-mt-32', className())">
      <div motion [initial]="{ opacity: 0, y: 18 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true, margin: '-60px' }" [transition]="{ duration: 0.6 }"
        class="mb-6 flex items-end gap-5">
        <span class="font-display text-[64px] font-black leading-none text-transparent md:text-[88px]" style="-webkit-text-stroke: 1.5px #CBD5E1">{{ n() }}</span>
        <div class="pb-2">
          <p class="text-[11px] font-extrabold uppercase tracking-[0.25em] text-emerald-700">{{ kicker() }}</p>
          <h2 class="font-display text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{{ title() }}<ng-content select="[chapterTitle]" /></h2>
        </div>
        <div class="mb-4 hidden h-px flex-1 bg-gradient-to-r from-slate-300 to-transparent md:block"></div>
      </div>
      <ng-content />
    </section>
  `,
})
export class Chapter {
  readonly id = input.required<string>();
  readonly n = input.required<string>();
  readonly kicker = input.required<string>();
  readonly title = input<string>('');
  readonly className = input<string>();
  protected cn = cn;
}

const GRAIN_BG = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Grain papier (texture) */
@Component({
  selector: 'ds-grain',
  host: { style: 'display: contents' },
  template: `<div aria-hidden="true" class="pointer-events-none absolute inset-0 mix-blend-multiply" [style.opacity]="opacity()" [style.background-image]="bg"></div>`,
})
export class Grain {
  readonly opacity = input(0.06);
  protected bg = GRAIN_BG;
}

const CONTOUR_PATHS = Array.from({ length: 14 }, (_, i) => ({
  d: `M -50 ${60 + i * 24} C 150 ${20 + i * 26}, 300 ${120 + i * 20}, 450 ${70 + i * 25} S 700 ${10 + i * 28}, 850 ${80 + i * 22}`,
  op: 0.12 + (i % 3) * 0.04,
  transition: { duration: 2.2, delay: i * 0.06 },
}));

/** Lignes topographiques décoratives */
@Component({
  selector: 'ds-contours',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg aria-hidden="true" viewBox="0 0 800 400" [attr.class]="className() || null" preserveAspectRatio="xMidYMid slice">
      @for (p of paths; track $index) {
        <path motion fill="none" [attr.stroke]="color()" [attr.stroke-opacity]="p.op" stroke-width="1" [attr.d]="p.d"
          [initial]="{ pathLength: 0 }" [animate]="{ pathLength: 1 }" [transition]="p.transition" />
      }
    </svg>
  `,
})
export class Contours {
  readonly className = input<string>();
  readonly color = input('#10B981');
  protected paths = CONTOUR_PATHS;
}

// -----------------------------------------------------------------------------
// Verger isométrique — rendu artistique du parcellaire réel
// -----------------------------------------------------------------------------
const GROUND: Record<CellType, [string, string]> = {
  neutral: ['#E9E4D4', '#D8D1BC'],
  forest: ['#2F6B3A', '#245530'],
  'early-cherry': ['#9BBF6A', '#86AB57'],
  'season-cherry': ['#93BA63', '#7FA553'],
  'late-cherry': ['#8AB35E', '#76A04E'],
};
const FRUIT: Record<CellType, string> = { neutral: '', forest: '', 'early-cherry': '#F59E0B', 'season-cherry': '#E11D48', 'late-cherry': '#7F1D1D' };
const FRUIT_POS = [[-6, -24], [5, -18], [2, -29], [-3, -15], [8, -26]];

function heatColor(v: number) {
  const stops = [[254, 240, 138], [249, 115, 22], [190, 18, 60]];
  const x = Math.max(0, Math.min(1, v)) * 2, i = Math.min(1, Math.floor(x)), f = x - i;
  const c = stops[i].map((s, k) => Math.round(s + (stops[i + 1][k] - s) * f));
  return `rgb(${c.join(',')})`;
}

const W = 34, H = 17; // demi-losange

@Component({
  selector: 'ds-iso-orchard',
  imports: [Motion, NgTemplateOutlet],
  host: { style: 'display: contents' },
  template: `
    <svg [attr.viewBox]="viewBox()" [attr.class]="className() || null" role="img" aria-label="Vue isométrique du verger">
      <defs>
        <radialGradient id="canopy" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#A7E08A" /><stop offset="60%" stop-color="#4D9A3F" /><stop offset="100%" stop-color="#2C6B2A" /></radialGradient>
        <radialGradient id="pine" cx="40%" cy="20%" r="90%"><stop offset="0%" stop-color="#4C9A5B" /><stop offset="100%" stop-color="#173F23" /></radialGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <!-- socle -->
      <path [attr.d]="base().top" fill="#CBBF9E" />
      <path [attr.d]="base().front" fill="#A8956B" />
      <path [attr.d]="base().side" fill="#8E7B55" />
      @for (c of cells(); track c.i) {
        <g>
          <path [attr.d]="c.d" [attr.fill]="c.ground" stroke="rgba(0,0,0,.06)" stroke-width="0.6" />
          @if (c.v > 0.05 && c.t !== 'neutral') { <path [attr.d]="c.d" [attr.fill]="c.heat" [attr.opacity]="0.25 + c.v * 0.55" /> }
          @if (c.t === 'forest') {
            <g [attr.transform]="c.tr">
              <ellipse cx="3" cy="4" rx="16" ry="6" fill="#000" opacity="0.18" filter="url(#soft)" />
              <path [attr.d]="'M0 ' + (-46 - (c.i % 3) * 6) + ' L13 -8 L-13 -8 Z'" fill="url(#pine)" />
              <path [attr.d]="'M0 ' + (-34 - (c.i % 3) * 6) + ' L16 2 L-16 2 Z'" fill="url(#pine)" />
              <rect x="-2" y="2" width="4" height="6" fill="#4A2F1B" />
            </g>
          }
          @if (c.t === 'early-cherry' || c.t === 'season-cherry' || c.t === 'late-cherry') {
            <g [attr.transform]="c.tr">
              <ellipse cx="3" cy="4" rx="13" ry="5" fill="#000" opacity="0.2" filter="url(#soft)" />
              <rect x="-1.8" y="-14" width="3.6" height="17" rx="1.5" fill="#5B3A24" />
              <circle cx="0" cy="-22" r="14" fill="url(#canopy)" />
              @for (f of fruitPos; track $index) {
                <circle [attr.cx]="f[0]" [attr.cy]="f[1]" r="2.1" [attr.fill]="c.fruit" stroke="#fff" stroke-opacity="0.4" stroke-width="0.5" />
              }
            </g>
          }
        </g>
      }
      <ng-template #fliesTpl>
      @for (c of hot(); track c.i; let k = $index) {
        <g motion [initial]="{ opacity: 0 }" [animate]="flyTarget"
          [transition]="{ opacity: { delay: 0.8 + k * 0.05 }, duration: 2 + (k % 4) * 0.4, repeat: 1e9, ease: 'easeInOut' }">
          <g [attr.transform]="flyTransform(c, k)">
            <ellipse cx="-3.5" cy="-2" rx="4" ry="2.2" fill="#E0F2FE" opacity="0.85" transform="rotate(-25)" />
            <ellipse cx="3.5" cy="-2" rx="4" ry="2.2" fill="#E0F2FE" opacity="0.85" transform="rotate(25)" />
            <ellipse cx="0" cy="0" rx="2.2" ry="3.4" fill="#B45309" />
            <circle cx="-1" cy="-3" r="0.9" fill="#DC2626" /><circle cx="1" cy="-3" r="0.9" fill="#DC2626" />
          </g>
        </g>
      }
      </ng-template>
      @if (flies() && !splitFlies()) { <ng-container [ngTemplateOutlet]="fliesTpl" /> }
    </svg>
    <!-- Avec une ombre portée (drop-shadow), les mouches passent dans un calque à part, sans filtre :
         le verger, statique, n'est rastérisé qu'une fois au lieu d'être redessiné avec son ombre à
         chaque image. Le verger est alors le seul enfant en flux de son parent positionné ou animé,
         ce qui place ce calque exactement dessus. -->
    @if (splitFlies()) {
      <svg [attr.viewBox]="viewBox()" aria-hidden="true" class="pointer-events-none absolute left-0 top-0 w-full" style="will-change: transform">
        <ng-container [ngTemplateOutlet]="fliesTpl" />
      </svg>
    }
  `,
})
export class IsoOrchard {
  readonly grid = input.required<CellType[]>();
  readonly heat = input<Float32Array | number[]>();
  readonly max = input<number>();
  readonly className = input<string>();
  readonly flies = input(true);
  readonly n = input(20);

  protected fruitPos = FRUIT_POS;
  protected flyTarget = { opacity: 1, x: [0, 6, -5, 3, 0], y: [0, -6, 2, -3, 0] };
  protected viewBox = computed(() => `0 0 ${2 * this.n() * W} ${2 * this.n() * H + 90}`);

  private P(x: number, y: number) { return [this.n() * W + (x - y) * W, 40 + (x + y) * H] as const; }

  protected base = computed(() => {
    const n = this.n();
    const P = (x: number, y: number) => this.P(x, y);
    return {
      top: `M${P(0, 0)[0]} ${P(0, 0)[1] - H} L${P(n, 0)[0] + 0} ${P(n, 0)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(0, n)[0]} ${P(0, n)[1] - H} Z`,
      front: `M${P(0, n)[0]} ${P(0, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H + 22} L${P(0, n)[0]} ${P(0, n)[1] - H + 22} Z`,
      side: `M${P(n, 0)[0]} ${P(n, 0)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H + 22} L${P(n, 0)[0]} ${P(n, 0)[1] - H + 22} Z`,
    };
  });

  protected cells = computed(() => {
    const n = this.n(), grid = this.grid(), heat = this.heat(), max = this.max();
    const out: { i: number; x: number; y: number; t: CellType; v: number; d: string; ground: string; heat: string; tr: string; fruit: string }[] = [];
    for (let s = 0; s < 2 * n - 1; s++) for (let x = 0; x < n; x++) {
      const y = s - x; if (y < 0 || y >= n) continue;
      const i = y * n + x;
      const t = grid[i];
      const v = heat && max ? Math.min(1, (heat[i] ?? 0) / max) : 0;
      const [cx, cy] = this.P(x, y);
      const top = cy - H;
      const g = GROUND[t];
      out.push({
        i, x, y, t, v,
        d: `M${cx} ${top - H} L${cx + W} ${top} L${cx} ${top + H} L${cx - W} ${top} Z`,
        ground: (x + y) % 2 ? g[0] : g[1],
        heat: v > 0.05 && t !== 'neutral' ? heatColor(v) : '',
        tr: `translate(${cx} ${top})`,
        fruit: FRUIT[t],
      });
    }
    return out;
  });

  /** Mouches dans un calque séparé quand le verger porte une ombre portée (voir le template). */
  protected splitFlies = computed(() => this.flies() && /drop-shadow/.test(this.className() ?? ''));

  protected hot = computed(() => this.cells().filter(c => c.v > 0.55 && c.t !== 'neutral').sort((a, b) => b.v - a.v).slice(0, 14));

  protected flyTransform(c: { x: number; y: number }, k: number) {
    const [cx, cy] = this.P(c.x, c.y);
    return `translate(${cx + ((k * 7) % 14) - 7} ${cy - H - 52 - (k % 3) * 8})`;
  }
}

const HILL_TREES = Array.from({ length: 26 }, (_, i) => `translate(${40 + i * 54} ${205 - Math.sin(i / 3) * 18})`);

/** Paysage décoratif : collines, rangs de cerisiers, soleil */
@Component({
  selector: 'ds-hills-backdrop',
  host: { style: 'display: contents' },
  template: `
    <svg aria-hidden="true" viewBox="0 0 1440 320" preserveAspectRatio="none" [attr.class]="className() || null">
      <defs>
        <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#065F46" /><stop offset="100%" stop-color="#022C22" /></linearGradient>
        <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#047857" /><stop offset="100%" stop-color="#064E3B" /></linearGradient>
      </defs>
      <path d="M0 210 C 240 140, 420 230, 720 170 S 1200 120, 1440 190 L1440 320 L0 320 Z" fill="url(#h2)" opacity="0.55" />
      @for (t of trees; track $index) {
        <g [attr.transform]="t" opacity="0.55">
          <rect x="-1" y="0" width="2" height="8" fill="#022C22" /><circle cx="0" cy="-3" r="7" fill="#065F46" />
          <circle cx="-3" cy="-4" r="1.3" fill="#F43F5E" /><circle cx="3" cy="-2" r="1.3" fill="#F43F5E" />
        </g>
      }
      <path d="M0 260 C 300 200, 540 290, 860 240 S 1260 210, 1440 250 L1440 320 L0 320 Z" fill="url(#h1)" />
    </svg>
  `,
})
export class HillsBackdrop {
  readonly className = input<string>();
  protected trees = HILL_TREES;
}
