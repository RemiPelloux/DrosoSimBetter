import { Component, ElementRef, afterNextRender, input, viewChild, type Type } from '@angular/core';
import { animate as fmAnimate } from 'framer-motion/dom';
import { Motion, motionAnimate } from './ui/motion';

// =============================================================================
// Illustrations SVG sur mesure — DrosoSim Next
// =============================================================================

/** Identifiants SVG uniques (équivalent de useId). */
let uidSeq = 0;
const uid = () => `u${++uidSeq}`;

/** Drosophila suzukii mâle stylisée (taches alaires caractéristiques), ailes animées. */
@Component({
  selector: 'ds-drosophila',
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" [attr.class]="className() || null" aria-label="Drosophila suzukii">
      <!-- ailes -->
      <g #wingL>
        <path d="M30 27 C 14 14, 4 22, 8 32 C 12 40, 24 36, 30 30 Z" fill="#E0F2FE" fill-opacity="0.75" stroke="#64748B" stroke-width="1" />
        @if (spots()) { <circle cx="12" cy="24" r="3.2" fill="#1E293B" /> }
      </g>
      <g #wingR>
        <path d="M34 27 C 50 14, 60 22, 56 32 C 52 40, 40 36, 34 30 Z" fill="#E0F2FE" fill-opacity="0.75" stroke="#64748B" stroke-width="1" />
        @if (spots()) { <circle cx="52" cy="24" r="3.2" fill="#1E293B" /> }
      </g>
      <!-- pattes -->
      <g stroke="#78350F" stroke-width="1.4" stroke-linecap="round" fill="none">
        <path d="M28 36 l-7 5 M28 40 l-8 8 M29 44 l-5 9" />
        <path d="M36 36 l7 5 M36 40 l8 8 M35 44 l5 9" />
      </g>
      <!-- abdomen rayé -->
      <ellipse cx="32" cy="42" rx="6.5" ry="10" fill="#B45309" />
      <path d="M26 41 h12 M26.5 45 h11 M28 49 h8" stroke="#451A03" stroke-width="1.6" stroke-linecap="round" />
      <!-- thorax -->
      <ellipse cx="32" cy="29" rx="6" ry="5.5" fill="#D97706" />
      <!-- tête + yeux rouges -->
      <circle cx="32" cy="21" r="5" fill="#B45309" />
      <circle cx="28.6" cy="20" r="2.6" fill="#DC2626" />
      <circle cx="35.4" cy="20" r="2.6" fill="#DC2626" />
      <circle cx="28" cy="19.3" r="0.8" fill="#FECACA" />
      <circle cx="34.8" cy="19.3" r="0.8" fill="#FECACA" />
    </svg>
  `,
})
export class Drosophila {
  readonly size = input(48);
  readonly animate = input(true);
  readonly className = input<string>();
  readonly spots = input(true);
  private wingL = viewChild.required<ElementRef<SVGGElement>>('wingL');
  private wingR = viewChild.required<ElementRef<SVGGElement>>('wingR');

  constructor() {
    afterNextRender(() => {
      const wings: [SVGGElement, string, number[]][] = [
        [this.wingL().nativeElement, '32px', [0, -18, 0, 14, 0]],
        [this.wingR().nativeElement, '34px', [0, 18, 0, -14, 0]],
      ];
      for (const [el, ox, rotate] of wings) {
        // pivot des ailes (style={{ originX, originY }} de framer-motion)
        fmAnimate(el, { originX: ox, originY: '28px' } as never, { duration: 0 });
        if (this.animate()) motionAnimate(el, { rotate }, { duration: 0.12, repeat: 1e9 });
      }
    });
  }
}

/** Cerise double stylisée */
@Component({
  selector: 'ds-cherry-art',
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" [attr.class]="className() || null">
      <defs>
        <radialGradient [attr.id]="'c' + id" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#fff" stop-opacity="0.55" /><stop offset="35%" [attr.stop-color]="color()" /><stop offset="100%" stop-color="#4C0519" /></radialGradient>
      </defs>
      <path d="M22 40 C 26 24, 32 14, 40 8 M44 38 C 42 26, 41 16, 40 8" stroke="#3F6212" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <path d="M40 8 C 48 4, 56 8, 58 14 C 50 16, 44 13, 40 8 Z" fill="#65A30D" />
      <circle cx="20" cy="46" r="11" [attr.fill]="'url(#c' + id + ')'" />
      <circle cx="45" cy="45" r="11" [attr.fill]="'url(#c' + id + ')'" />
    </svg>
  `,
})
export class CherryArt {
  readonly size = input(48);
  readonly className = input<string>();
  readonly color = input('#E11D48');
  protected id = uid();
}

/** Logo : feuille + cerise + œil de drosophile */
@Component({
  selector: 'ds-logo',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg motion viewBox="0 0 48 48" [attr.width]="size()" [attr.height]="size()" [whileHover]="animated() ? { rotate: -8, scale: 1.06 } : undefined" [transition]="{ type: 'spring', stiffness: 300 }">
      <rect width="48" height="48" rx="13" fill="#047857" />
      <path d="M12 34 C 12 18, 24 10, 38 10 C 38 26, 28 36, 12 34 Z" fill="#10B981" />
      <path d="M13 34 C 20 26, 27 20, 36 12" stroke="#ECFDF5" stroke-width="1.8" fill="none" stroke-linecap="round" />
      <circle motion cx="33" cy="33" r="6.5" fill="#E11D48" stroke="#fff" stroke-width="1.5"
        [animate]="animated() ? { scale: [1, 1.12, 1] } : undefined" [transition]="{ duration: 2.4, repeat: 1e9 }" />
      <circle cx="31" cy="31" r="1.6" fill="#fff" opacity="0.7" />
    </svg>
  `,
})
export class Logo {
  readonly size = input(36);
  readonly animated = input(true);
}

const FLY_PATHS = [
  { x: ['0%', '30%', '62%', '90%', '45%', '0%'], y: ['20%', '5%', '30%', '15%', '60%', '20%'], d: 18 },
  { x: ['85%', '60%', '20%', '10%', '55%', '85%'], y: ['70%', '85%', '60%', '30%', '40%', '70%'], d: 22 },
  { x: ['40%', '70%', '80%', '35%', '15%', '40%'], y: ['90%', '65%', '35%', '20%', '75%', '90%'], d: 26 },
  { x: ['10%', '25%', '55%', '75%', '50%', '10%'], y: ['50%', '80%', '90%', '55%', '10%', '50%'], d: 20 },
  { x: ['70%', '95%', '75%', '40%', '60%', '70%'], y: ['10%', '45%', '75%', '50%', '20%', '10%'], d: 24 },
].map(p => ({ ...p, target: { left: p.x, top: p.y, rotate: [0, 25, -20, 15, -10, 0] }, transition: { duration: p.d, repeat: 1e9, ease: 'easeInOut' } }));

/** Essaim de drosophiles qui volent sur des trajectoires organiques */
@Component({
  selector: 'ds-flying-flies',
  imports: [Motion, Drosophila],
  host: { style: 'display: contents' },
  template: `
    <div [class]="'pointer-events-none absolute inset-0 ' + (className() ?? '')" aria-hidden="true">
      @for (p of paths().slice(0, count()); track $index; let i = $index) {
        <div motion class="absolute -translate-x-1/2 -translate-y-1/2" [animate]="p.target" [transition]="p.transition">
          <div motion [animate]="{ y: [0, -4, 0, 3, 0] }" [transition]="{ duration: 0.8, repeat: 1e9 }">
            <ds-drosophila [size]="22 + (i % 3) * 6" />
          </div>
        </div>
      }
    </div>
  `,
})
export class FlyingFlies {
  readonly count = input(5);
  readonly className = input<string>();
  protected paths = () => FLY_PATHS;
}

/** Mouche qui « bourdonne » sur place (états vides, chargements) */
@Component({
  selector: 'ds-buzzing-fly',
  imports: [Motion, Drosophila],
  host: { style: 'display: contents' },
  template: `
    <div motion [animate]="{ x: [0, 6, -5, 4, 0], y: [0, -5, 3, -2, 0], rotate: [0, 8, -6, 4, 0] }" [transition]="{ duration: 2.2, repeat: 1e9, ease: 'easeInOut' }" class="inline-block">
      <ds-drosophila [size]="size()" />
    </div>
  `,
})
export class BuzzingFly {
  readonly size = input(56);
}

// =============================================================================
// Schémas pédagogiques (documentation)
// =============================================================================

/** Marqueur de flèche (équivalent de <ArrowDefs>) — inséré dans le template du <svg>. */
const ARROW_DEFS = `
      <defs>
        <marker [attr.id]="id" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#475569" />
        </marker>
      </defs>`;
const ARROW_DEFS_DARK = `
      <defs>
        <marker [attr.id]="id" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#0F172A" />
        </marker>
      </defs>`;

const LIFE_STAGES = [
  { x: 300, y: 50, l: 'Œuf', s: 'pondu dans le fruit', c: '#FEF3C7', e: '🥚' },
  { x: 520, y: 170, l: 'Larve', s: 'se nourrit de la pulpe', c: '#FFEDD5', e: '🐛' },
  { x: 300, y: 290, l: 'Pupe', s: 'dans ou hors du fruit', c: '#FDE68A', e: '🫘' },
  { x: 80, y: 170, l: 'Adulte ♀', s: 'vit ~3-9 semaines', c: '#DCFCE7', e: '🪰' },
];
const LIFE_ARROWS = [[360, 70, 500, 140], [500, 210, 360, 280], [240, 280, 100, 210], [100, 135, 240, 65]]
  .map(([x1, y1, x2, y2], i) => `M${x1} ${y1} Q ${(x1 + x2) / 2 + (i % 2 ? -30 : 30)} ${(y1 + y2) / 2} ${x2} ${y2}`);

/** Cycle biologique : œuf → larve → pupe → adulte, avec flux du modèle */
@Component({
  selector: 'ds-life-cycle-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="-10 0 620 350" class="w-full" role="img" aria-label="Cycle biologique de D. suzukii">
      ${ARROW_DEFS}
      <circle motion cx="300" cy="170" r="118" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="6 8"
        [animate]="{ strokeDashoffset: [0, -56] }" [transition]="{ duration: 3, repeat: 1e9, ease: 'linear' }" />
      <text x="300" y="160" text-anchor="middle" font-size="15" font-weight="800" fill="#0F172A">Immatures S₁ → S₂ → S₃</text>
      <text x="300" y="180" text-anchor="middle" font-size="11" fill="#475569">trois sous-stades (délai gamma)</text>
      <text x="300" y="198" text-anchor="middle" font-size="11" fill="#475569">≈ 210 degrés-jours &gt; 8 °C</text>
      @for (d of arrows; track $index) {
        <path [attr.d]="d" stroke="#475569" stroke-width="2" fill="none" [attr.marker-end]="'url(#' + id + ')'" />
      }
      @for (s of stages; track s.l; let i = $index) {
        <g motion [initial]="{ scale: 0.8, opacity: 0 }" [whileInView]="{ scale: 1, opacity: 1 }" [viewport]="{ once: true }" [transition]="{ delay: i * 0.12 }">
          <rect [attr.x]="s.x - 78" [attr.y]="s.y - 32" width="156" height="64" rx="16" [attr.fill]="s.c" stroke="#0F172A" stroke-opacity="0.15" />
          <text [attr.x]="s.x - 66" [attr.y]="s.y + 7" font-size="22">{{ s.e }}</text>
          <text [attr.x]="s.x - 34" [attr.y]="s.y - 3" font-size="14" font-weight="800" fill="#0F172A">{{ s.l }}</text>
          <text [attr.x]="s.x - 34" [attr.y]="s.y + 14" font-size="10" fill="#475569">{{ s.s }}</text>
        </g>
      }
      <text x="440" y="92" font-size="11" fill="#B45309" font-weight="700">ponte × survie des œufs</text>
      <text x="40" y="92" font-size="11" fill="#15803D" font-weight="700">émergence = 3·δ(T) × S₃</text>
    </svg>
  `,
})
export class LifeCycleDiagram {
  protected id = uid();
  protected stages = LIFE_STAGES;
  protected arrows = LIFE_ARROWS;
}

const DAILY_STEPS = [
  { t: '1. Climat', d: 'tables : T(j), ponte, développement, froid, chaleur', c: '#DBEAFE' },
  { t: '2. Traitements', d: 'déclenchement calendaire / seuil, DAR', c: '#FEF3C7' },
  { t: '3. Ressource & capacité', d: 'fruits, résidus, K du jour, filets actifs', c: '#FCE7F3' },
  { t: '4. Dynamique locale', d: 'ponte → dégâts → S₁ S₂ S₃ → émergence → mortalité', c: '#DCFCE7' },
  { t: '5. Dispersion', d: '8 voisines, pondérée, filets symétriques', c: '#EDE9FE' },
  { t: '6. Bilan du jour', d: 'récolte, pics, séries (tous les 3 j)', c: '#F1F5F9' },
].map((s, i) => ({ ...s, x: 10 + (i % 3) * 240, y: i < 3 ? 20 : 130 }));

/** Déroulé d'un pas de temps journalier */
@Component({
  selector: 'ds-daily-step-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="-44 0 764 236" class="w-full" role="img" aria-label="Pas de temps journalier">
      ${ARROW_DEFS}
      @for (s of steps; track s.t; let i = $index) {
        <g motion [initial]="{ opacity: 0, y: 10 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" [transition]="{ delay: i * 0.1 }">
          <rect [attr.x]="s.x" [attr.y]="s.y" width="200" height="78" rx="14" [attr.fill]="s.c" stroke="#0F172A" stroke-opacity="0.12" />
          <text [attr.x]="s.x + 14" [attr.y]="s.y + 30" font-size="14" font-weight="800" fill="#0F172A">{{ s.t }}</text>
          <foreignObject [attr.x]="s.x + 14" [attr.y]="s.y + 38" width="180" height="40"><p style="font-size: 10.5px; color: #475569; line-height: 1.3; margin: 0px">{{ s.d }}</p></foreignObject>
        </g>
      }
      <path d="M212 59 H 246" stroke="#475569" stroke-width="2" [attr.marker-end]="url" />
      <path d="M452 59 H 486" stroke="#475569" stroke-width="2" [attr.marker-end]="url" />
      <path d="M570 99 V 127" stroke="#475569" stroke-width="2" [attr.marker-end]="url" />
      <path d="M486 169 H 452" stroke="#475569" stroke-width="2" [attr.marker-end]="url" />
      <path d="M246 169 H 212" stroke="#475569" stroke-width="2" [attr.marker-end]="url" />
      <path motion d="M8 169 C -34 169, -34 59, 8 59" stroke="#10B981" stroke-width="2.5" fill="none" stroke-dasharray="5 5" [attr.marker-end]="url"
        [animate]="{ strokeDashoffset: [0, -20] }" [transition]="{ duration: 1, repeat: 1e9, ease: 'linear' }" />
      <text x="360" y="225" text-anchor="middle" font-size="11" fill="#047857" font-weight="700">répété chaque jour, de 365 à 1 187 fois selon la durée</text>
    </svg>
  `,
})
export class DailyStepDiagram {
  protected id = uid();
  protected url = `url(#${this.id})`;
  protected steps = DAILY_STEPS;
}

const NB_W = [[0.25, 3, 3], [0.6, null, 3], [0.15, 0.15, 0.25]];
const NB_LAB = [['Cerisier hors saison', 'Cerisier véraison', 'Cerisier véraison'], ['Forêt', 'Case source', 'Cerisier véraison'], ['Neutre', 'Neutre', 'Cerisier hors saison']];
const nbCol = (v: number | null) => (v === null ? '#0F172A' : v >= 3 ? '#E11D48' : v >= 0.5 ? '#15803D' : v >= 0.2 ? '#D97706' : '#CBD5E1');
const NB_SUM = NB_W.flat().reduce<number>((a, b) => a + (b ?? 0), 0);
const NB_CELLS = NB_W.flatMap((row, y) => row.map((v, x) => ({
  key: `${x}${y}`, x, y, v, fill: nbCol(v), label: NB_LAB[y][x],
  x2: 63 + x * 90 + (x - 1) * -28, y2: 63 + y * 90 + (y - 1) * -28,
})));

/** Voisinage de dispersion 3×3 */
@Component({
  selector: 'ds-neighborhood-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 640 300" class="w-full" role="img" aria-label="Dispersion vers les 8 voisines">
      ${ARROW_DEFS_DARK}
      @for (c of cells; track c.key) {
        <g>
          <rect [attr.x]="20 + c.x * 90" [attr.y]="20 + c.y * 90" width="86" height="86" rx="10" [attr.fill]="c.fill" [attr.fill-opacity]="c.v === null ? 1 : 0.85" />
          <text [attr.x]="63 + c.x * 90" [attr.y]="56 + c.y * 90" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">{{ c.v === null ? 'A·D' : '×' + c.v }}</text>
          <foreignObject [attr.x]="24 + c.x * 90" [attr.y]="64 + c.y * 90" width="78" height="40"><p style="font-size: 9px; color: #fff; text-align: center; line-height: 1.15; margin: 0px">{{ c.label }}</p></foreignObject>
          @if (c.v !== null) {
            <line motion x1="153" y1="153" [attr.x2]="c.x2" [attr.y2]="c.y2" stroke="#0F172A" [attr.stroke-width]="max1(c.v)" [attr.marker-end]="'url(#' + id + ')'"
              [initial]="{ pathLength: 0 }" [whileInView]="{ pathLength: 1 }" [viewport]="{ once: true }" [transition]="{ duration: 0.8, delay: 0.1 * (c.x + c.y) }" />
          }
        </g>
      }
      <g font-size="12" fill="#334155">
        <text x="320" y="40" font-weight="800" font-size="14" fill="#0F172A">Règle de répartition</text>
        <text x="320" y="66">• Chaque jour, D = 12 % des femelles quittent la case</text>
        <text x="332" y="82">(3 % si T ≤ 10 °C).</text>
        <text x="320" y="106">• Part reçue par la voisine n :  w(n) / Σw</text>
        <text x="320" y="130">• Ici Σw = {{ sum.toFixed(2) }} → une voisine en véraison</text>
        <text x="332" y="146">reçoit {{ (3 / sum * 100).toFixed(0) }} % des émigrantes, la forêt {{ (0.6 / sum * 100).toFixed(0) }} %.</text>
        <text x="320" y="172">• Filet actif sur la voisine : 70 % × efficacité</text>
        <text x="332" y="188">de la part est refoulée vers la case source.</text>
        <text x="320" y="214">• Effet net : les adultes « coulent » des zones</text>
        <text x="332" y="230">refuges vers les vergers mûrs.</text>
      </g>
    </svg>
  `,
})
export class NeighborhoodDiagram {
  protected id = uid();
  protected cells = NB_CELLS;
  protected sum = NB_SUM;
  protected max1 = (v: number) => Math.max(1, v);
}

const PX = (doy: number) => 40 + (doy / 365) * 640;
const PH_MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => ({ m, x: PX(i * 30.4), tx: PX(i * 30.4 + 15) }));
const PH_BANDS = [
  { l: 'Précoce', a: 130, b: 158, c: '#D97706', y: 168 },
  { l: 'Saison', a: 150, b: 178, c: '#E11D48', y: 190 },
  { l: 'Tardive', a: 168, b: 200, c: '#991B1B', y: 212 },
].map(b => ({ ...b, x: PX(b.a), w: PX(b.b) - PX(b.a), tx: PX(b.b) + 6 }));
// courbe type de pression (forme indicative)
const PH_PTS = Array.from({ length: 74 }, (_, i) => {
  const d = i * 5;
  const v = Math.exp(-Math.pow((d - 215) / 38, 2)) * 0.95 + Math.exp(-Math.pow((d - 290) / 45, 2)) * 0.35 + 0.04;
  return `${PX(d)},${150 - v * 120}`;
}).join(' ');

/** Frise phénologique annuelle avec courbe de pression type */
@Component({
  selector: 'ds-phenology-timeline',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 720 250" class="w-full" role="img" aria-label="Phénologie et pression">
      @for (m of months; track $index) {
        <g>
          <line [attr.x1]="m.x" y1="20" [attr.x2]="m.x" y2="226" stroke="#E2E8F0" />
          <text [attr.x]="m.tx" y="244" text-anchor="middle" font-size="11" fill="#64748B">{{ m.m }}</text>
        </g>
      }
      @for (b of bands; track b.l) { <rect [attr.x]="b.x" y="20" [attr.width]="b.w" height="135" [attr.fill]="b.c" opacity="0.12" /> }
      <polyline motion [attr.points]="pts" fill="none" stroke="#0F172A" stroke-width="2.5" [initial]="{ pathLength: 0 }" [whileInView]="{ pathLength: 1 }" [viewport]="{ once: true }" [transition]="{ duration: 1.6 }" />
      <text [attr.x]="X(222)" y="26" font-size="11" font-weight="700" fill="#0F172A">pic estival</text>
      <text [attr.x]="X(282)" y="100" font-size="10" fill="#475569">rebond post-récolte (résidus)</text>
      <line x1="40" y1="110" x2="680" y2="110" stroke="#DC2626" stroke-dasharray="5 4" />
      <text x="684" y="113" font-size="9" fill="#DC2626">seuil</text>
      @for (b of bands; track b.l) {
        <g>
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" height="16" rx="5" [attr.fill]="b.c" />
          <text [attr.x]="b.tx" [attr.y]="b.y + 12" font-size="11" font-weight="700" [attr.fill]="b.c">{{ b.l }} : véraison → récolte</text>
        </g>
      }
      <text [attr.x]="X(10)" y="40" font-size="10" fill="#64748B">hivernage en forêt</text>
    </svg>
  `,
})
export class PhenologyTimeline {
  protected months = PH_MONTHS;
  protected bands = PH_BANDS;
  protected pts = PH_PTS;
  protected X = PX;
}

const LEVER_LABELS = ['Ressource', 'Adultes A', 'Ponte', 'Larves L', 'Fertilité'].map((t, i) => ({ t, x: 100 + i * 140 }));
const LEVER_ITEMS = [
  { l: 'Filet', c: '#2563EB', on: 'accès aux fruits & immigration', x: 18 },
  { l: 'Traitement', c: '#D97706', on: 'mortalité des adultes', x: 158 },
  { l: 'Prophylaxie', c: '#0D9488', on: 'fruits résiduels post-récolte', x: 298 },
  { l: 'Parasitoïdes', c: '#7C3AED', on: 'survie des larves', x: 438 },
  { l: 'TIS', c: '#DB2777', on: 'fertilité des pontes', x: 578 },
].map((it, i) => {
  const target = [100 + 140 * 2, 100 + 140, 100, 100 + 140 * 3, 100 + 140 * 4][i];
  return { ...it, d: `M${it.x + 62} 66 C ${it.x + 62} 84, ${target} 78, ${target} 98` };
});

/** Effet de chaque levier sur le cycle */
@Component({
  selector: 'ds-lever-map-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 720 170" class="w-full" role="img" aria-label="Points d'action des leviers">
      <rect x="10" y="100" width="700" height="56" rx="14" fill="#F8FAFC" stroke="#E2E8F0" />
      @for (t of labels; track t.t) {
        <text [attr.x]="t.x" y="134" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">{{ t.t }}</text>
      }
      @for (it of items; track it.l; let i = $index) {
        <g motion [initial]="{ opacity: 0, y: -10 }" [whileInView]="{ opacity: 1, y: 0 }" [viewport]="{ once: true }" [transition]="{ delay: i * 0.1 }">
          <rect [attr.x]="it.x" y="6" width="124" height="60" rx="10" [attr.fill]="it.c" />
          <text [attr.x]="it.x + 62" y="26" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">{{ it.l }}</text>
          <foreignObject [attr.x]="it.x + 6" y="31" width="112" height="32"><p style="font-size: 9px; color: #fff; text-align: center; margin: 0px; opacity: 0.92; line-height: 1.2">{{ it.on }}</p></foreignObject>
          <path [attr.d]="it.d" [attr.stroke]="it.c" stroke-width="2" fill="none" stroke-dasharray="4 3" />
        </g>
      }
    </svg>
  `,
})
export class LeverMapDiagram {
  protected labels = LEVER_LABELS;
  protected items = LEVER_ITEMS;
}

const ECO_BOXES = [
  { x: 10, y: 20, w: 170, t: '% fruits sains', s: 'issu de la simulation', c: '#DCFCE7' },
  { x: 10, y: 140, w: 170, t: 'Surface × rdt × prix', s: 'hypothèses éditables', c: '#DBEAFE' },
  { x: 250, y: 80, w: 160, t: 'CA stratégie', s: '− CA du témoin', c: '#FEF3C7' },
  { x: 250, y: 160, w: 160, t: 'Coûts leviers', s: 'filets, MO, intrants', c: '#FFE4E6' },
  { x: 480, y: 80, w: 220, t: 'Bilan net = CA sauvé − coûts', s: 'ROI = CA sauvé / coûts', c: '#0F172A' },
];

/** Chaîne de calcul économique */
@Component({
  selector: 'ds-economics-diagram',
  host: { style: 'display: contents' },
  template: `
    <svg viewBox="0 0 720 220" class="w-full" role="img" aria-label="Chaîne de calcul économique">
      ${ARROW_DEFS}
      @for (b of boxes; track b.t) {
        <g>
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" height="58" rx="12" [attr.fill]="b.c" stroke="#0F172A" stroke-opacity="0.1" />
          <text [attr.x]="b.x + b.w / 2" [attr.y]="b.y + 25" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">{{ b.t }}</text>
          <text [attr.x]="b.x + b.w / 2" [attr.y]="b.y + 43" text-anchor="middle" font-size="10" fill="#475569">{{ b.s }}</text>
        </g>
      }
      <text x="590" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">Bilan net = CA sauvé − coûts</text>
      <text x="590" y="123" text-anchor="middle" font-size="10" fill="#CBD5E1">ROI = CA sauvé / coûts</text>
      <path d="M180 49 C 220 49, 215 100, 248 105" stroke="#475569" stroke-width="2" fill="none" [attr.marker-end]="url" />
      <path d="M180 169 C 220 169, 215 115, 248 112" stroke="#475569" stroke-width="2" fill="none" [attr.marker-end]="url" />
      <path d="M410 109 H 478" stroke="#475569" stroke-width="2" [attr.marker-end]="url" />
      <path d="M410 189 C 450 189, 450 125, 478 118" stroke="#475569" stroke-width="2" fill="none" [attr.marker-end]="url" />
    </svg>
  `,
})
export class EconomicsDiagram {
  protected id = uid();
  protected url = `url(#${this.id})`;
  protected boxes = ECO_BOXES;
}

export const DIAGRAMS: Record<string, Type<unknown>> = {
  'cycle': LifeCycleDiagram,
  'pas-de-temps': DailyStepDiagram,
  'voisinage': NeighborhoodDiagram,
  'phenologie': PhenologyTimeline,
  'leviers': LeverMapDiagram,
  'economie': EconomicsDiagram,
};
