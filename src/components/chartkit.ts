// =============================================================================
// Mini-moteur de graphiques SVG — reproduit le rendu de Recharts 3 (marges,
// axes, graduations « nice », grilles, étiquettes, info-bulles, légendes) pour
// les graphiques de DrosoSim Next, sans dépendre de React.
// Les algorithmes (graduations, masquage des graduations qui se chevauchent,
// position des barres, coupure des étiquettes) sont portés de Recharts 3.10.
// =============================================================================
import { Component, Directive, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';

export interface Box { x: number; y: number; width: number; height: number }
export interface Margin { top: number; right: number; bottom: number; left: number }
export type Anchor = 'start' | 'middle' | 'end';

// ---------------------------------------------------------------- Mesure du texte
let ctx: CanvasRenderingContext2D | null = null;
let family = '';
/** Largeur d'un texte (équivalent de getStringSize de Recharts : police héritée du body). */
export function textWidth(text: string, fontSize?: number, weight: string | number = 'normal'): number {
  if (typeof document === 'undefined') return 0;
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return 0;
  const cs = getComputedStyle(document.body);
  family ||= cs.fontFamily;
  ctx.font = `${weight} ${fontSize ?? parseFloat(cs.fontSize || '16')}px ${family}`;
  return ctx.measureText(text).width;
}


/** dy de la première ligne selon l'ancrage vertical (Text de Recharts : capHeight 0.71em, lineHeight 1em). */
export function startDy(vertical: 'start' | 'middle' | 'end', n: number): string {
  if (vertical === 'start') return '0.71em';
  if (vertical === 'middle') return `${round((n - 1) / 2 * -1 + 0.355)}em`;
  return `${-(n - 1)}em`;
}

// ---------------------------------------------------------------- Graduations « nice » (getNiceTickValues)
const round = (v: number) => +v.toPrecision(12);
function digitCount(v: number) { return v === 0 ? 1 : Math.floor(Math.log10(Math.abs(v))) + 1; }
function adaptiveStep(rough: number, allowDecimals: boolean, cf: number) {
  if (rough <= 0) return 0;
  const dc = digitCount(rough);
  const dv = Math.pow(10, dc);
  const ratio = round(rough / dv);
  const scale = dc !== 1 ? 0.05 : 0.1;
  const amend = round((Math.ceil(round(ratio / scale)) + cf) * scale);
  const step = round(amend * dv);
  return allowDecimals ? step : Math.ceil(step);
}
function calculateStep(min: number, max: number, count: number, allowDecimals: boolean, cf = 0): { step: number; tickMin: number; tickMax: number } {
  if (!Number.isFinite((max - min) / (count - 1))) return { step: 0, tickMin: 0, tickMax: 0 };
  const step = adaptiveStep(round((max - min) / (count - 1)), allowDecimals, cf);
  let middle: number;
  if (min <= 0 && max >= 0) middle = 0;
  else { middle = round((min + max) / 2); middle = round(middle - (middle % step)); }
  let below = Math.ceil(round((middle - min) / step));
  let up = Math.ceil(round((max - middle) / step));
  const scaleCount = below + up + 1;
  if (scaleCount > count) return calculateStep(min, max, count, allowDecimals, cf + 1);
  if (scaleCount < count) {
    up = max > 0 ? up + (count - scaleCount) : up;
    below = max > 0 ? below : below + (count - scaleCount);
  }
  return { step, tickMin: round(middle - below * step), tickMax: round(middle + up * step) };
}
function tickOfSingleValue(value: number, count: number, allowDecimals: boolean) {
  let step = 1;
  let middle = value;
  if (!Number.isInteger(value) && allowDecimals) {
    const abs = Math.abs(value);
    if (abs < 1) { step = Math.pow(10, digitCount(value) - 1); middle = round(Math.floor(value / step) * step); }
    else if (abs > 1) middle = Math.floor(value);
  } else if (value === 0) middle = Math.floor((count - 1) / 2);
  else if (!allowDecimals) middle = Math.floor(value);
  const mid = Math.floor((count - 1) / 2);
  return Array.from({ length: count }, (_, i) => round(middle + (i - mid) * step));
}
export function niceTicks(min: number, max: number, count = 5, allowDecimals = true): number[] {
  const c = Math.max(count, 2);
  const [lo, hi] = min > max ? [max, min] : [min, max];
  if (lo === hi) return tickOfSingleValue(lo, count, allowDecimals);
  const { step, tickMin, tickMax } = calculateStep(lo, hi, c, allowDecimals);
  const out: number[] = [];
  if (step <= 0) return [tickMin];
  for (let v = tickMin, i = 0; v < tickMax + 0.1 * step && i < 100000; v = round(v + step), i++) out.push(v);
  return min > max ? out.reverse() : out;
}

/** Domaine d'un axe numérique « auto » ([0, 'auto'] par défaut dans Recharts, étendu aux données). */
export function autoDomain(values: number[], fixed?: [number, number]): { domain: [number, number]; ticks: number[] } {
  if (fixed) return { domain: fixed, ticks: niceTicks(fixed[0], fixed[1]) };
  let lo = 0, hi = -Infinity;
  for (const v of values) if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi === -Infinity) hi = 0;
  if (hi < 0) hi = 0; // la borne 0 de [0, 'auto'] reste incluse
  const ticks = niceTicks(lo, hi);
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain, [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + (v - d0) * k);
}

// ---------------------------------------------------------------- Axes
export interface TickItem { coord: number; tickCoord: number; label: string; lines?: string[] }
export interface AxisSpec {
  box: Box;
  orient: 'bottom' | 'left';
  ticks: TickItem[];
  fontSize: number;
  fill: string;
  fontWeight?: number;
  /** Graduation personnalisée sur deux lignes (WrapTick) */
  wrap?: boolean;
  label?: TextSpec | null;
}

/** Masque les graduations qui se chevauchent en conservant la dernière (interval="preserveEnd", minTickGap 5). */
export function preserveEnd(ticks: { coord: number; label: string }[], box: Box, orient: 'bottom' | 'left', fontSize: number, minTickGap = 5): TickItem[] {
  const sizeOf = (t: { label: string }) => (orient === 'bottom' ? textWidth(t.label, fontSize) : fontSize * 1.25);
  const sign = ticks.length >= 2 ? Math.sign(ticks[1].coord - ticks[0].coord) || 1 : 1;
  const isW = orient === 'bottom';
  const start = sign === 1 ? (isW ? box.x : box.y) : (isW ? box.x + box.width : box.y + box.height);
  let end = sign === 1 ? (isW ? box.x + box.width : box.y + box.height) : (isW ? box.x : box.y);
  const out: TickItem[] = [];
  for (let i = ticks.length - 1; i >= 0; i--) {
    const t = ticks[i];
    const size = sizeOf(t);
    let tickCoord = t.coord;
    if (i === ticks.length - 1) {
      const gap = sign * (t.coord + sign * size / 2 - end);
      tickCoord = gap > 0 ? t.coord - gap * sign : t.coord;
    }
    if (sign * tickCoord < sign * start || sign * tickCoord > sign * end) continue;
    const show = sign * (tickCoord - sign * size / 2 - start) >= 0 && sign * (tickCoord + sign * size / 2 - end) <= 0;
    if (show) {
      end = tickCoord - sign * (size / 2 + minTickGap);
      out.unshift({ coord: t.coord, tickCoord, label: t.label });
    }
  }
  return out;
}

export const allTicks = (ticks: { coord: number; label: string }[]): TickItem[] => ticks.map(t => ({ ...t, tickCoord: t.coord }));

// ---------------------------------------------------------------- Texte
export interface TextSpec {
  x: number; y: number; lines: string[]; anchor: Anchor; dy0: string;
  fill?: string; fontSize?: number; fontWeight?: number | string; transform?: string; cls?: string;
}


/** Étiquette positionnée comme Label de Recharts (offset 5). */
export function cartesianLabel(value: string, position: 'insideTop' | 'insideTopRight' | 'top' | 'insideLeft', b: Box, style: { fontSize?: number; fill?: string; angle?: number; fontWeight?: number }, offset = 5): TextSpec {
  const vSign = b.height >= 0 ? 1 : -1;
  const hSign = b.width >= 0 ? 1 : -1;
  let x = 0, y = 0, anchor: Anchor = 'middle', vertical: 'start' | 'middle' | 'end' = 'middle';
  if (position === 'top') { x = b.x + b.width / 2; y = b.y - vSign * offset; anchor = 'middle'; vertical = vSign > 0 ? 'end' : 'start'; }
  else if (position === 'insideTop') { x = b.x + b.width / 2; y = b.y + vSign * offset; anchor = 'middle'; vertical = vSign > 0 ? 'start' : 'end'; }
  else if (position === 'insideTopRight') { x = b.x + b.width - hSign * offset; y = b.y + vSign * offset; anchor = hSign > 0 ? 'end' : 'start'; vertical = vSign > 0 ? 'start' : 'end'; }
  else { x = b.x + hSign * offset; y = b.y + b.height / 2; anchor = hSign > 0 ? 'start' : 'end'; vertical = 'middle'; }
  const lines = [value]; // Recharts ne coupe pas les étiquettes Label (vérifié sur le rendu de référence)
  return {
    x, y, lines, anchor, dy0: startDy(vertical, lines.length), fill: style.fill ?? '#808080', fontSize: style.fontSize, fontWeight: style.fontWeight,
    transform: style.angle ? `rotate(${style.angle}, ${x}, ${y})` : undefined, cls: 'recharts-text recharts-label',
  };
}

// ---------------------------------------------------------------- Formes
/** Rectangle aux coins arrondis [haut-gauche, haut-droit, bas-droit, bas-gauche] (Rectangle de Recharts). */
export function rectPath(x: number, y: number, w: number, h: number, radius: [number, number, number, number] | number = 0): string {
  const maxR = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
  const ySign = h >= 0 ? 1 : -1, xSign = w >= 0 ? 1 : -1;
  const clockWise = (h >= 0 && w >= 0) || (h < 0 && w < 0) ? 1 : 0;
  const r = (Array.isArray(radius) ? radius : [radius, radius, radius, radius]).map(v => (v > maxR ? maxR : v));
  if (maxR > 0 && r.some(v => v > 0)) {
    let p = `M${x},${y + ySign * r[0]}`;
    if (r[0] > 0) p += `A ${r[0]},${r[0]},0,0,${clockWise},${x + xSign * r[0]},${y}`;
    p += `L ${x + w - xSign * r[1]},${y}`;
    if (r[1] > 0) p += `A ${r[1]},${r[1]},0,0,${clockWise},\n        ${x + w},${y + ySign * r[1]}`;
    p += `L ${x + w},${y + h - ySign * r[2]}`;
    if (r[2] > 0) p += `A ${r[2]},${r[2]},0,0,${clockWise},\n        ${x + w - xSign * r[2]},${y + h}`;
    p += `L ${x + xSign * r[3]},${y + h}`;
    if (r[3] > 0) p += `A ${r[3]},${r[3]},0,0,${clockWise},\n        ${x},${y + h - ySign * r[3]}`;
    return p + 'Z';
  }
  return `M ${x},${y} h ${w} v ${h} h ${-w} Z`;
}

/** Position des barres d'une catégorie (combineAllBarPositions, sans barSize). */
export function barPositions(bandSize: number, len: number, barCategoryGap: string | number = '10%', barGap = 4) {
  const pct = (v: string | number) => (typeof v === 'string' && v.endsWith('%') ? bandSize * parseFloat(v) / 100 : +v);
  let gap = Math.min(barGap, bandSize);
  const offset = Math.min(pct(barCategoryGap), bandSize);
  if (bandSize - 2 * offset - (len - 1) * gap <= 0) gap = 0;
  let size = (bandSize - 2 * offset - (len - 1) * gap) / len;
  if (size > 1) size = Math.round(size);
  return Array.from({ length: len }, (_, i) => ({ offset: offset + (size + gap) * i, size }));
}

// ---------------------------------------------------------------- Composants SVG partagés
@Component({
  selector: 'g[dsText]',
  template: `
    @let s = dsText();
    <svg:text [attr.x]="s.x" [attr.y]="s.y" [attr.text-anchor]="s.anchor" [attr.fill]="s.fill" [attr.font-size]="s.fontSize" [attr.font-weight]="s.fontWeight"
      [attr.transform]="s.transform" [attr.class]="s.cls ?? 'recharts-text'" stroke="none">
      @for (l of s.lines; track $index) { <svg:tspan [attr.x]="s.x" [attr.dy]="$index ? '1em' : s.dy0">{{ l }}</svg:tspan> }
    </svg:text>
  `,
})
export class SvgText {
  readonly dsText = input.required<TextSpec>();
}

@Component({
  selector: 'g[dsAxis]',
  imports: [SvgText],
  host: { '[attr.class]': '"recharts-layer recharts-cartesian-axis recharts-" + (a().orient === "bottom" ? "xAxis xAxis" : "yAxis yAxis")' },
  template: `
    @let s = a();
    @if (s.orient === 'bottom') {
      <svg:line class="recharts-cartesian-axis-line" stroke="#666" fill="none" [attr.x1]="s.box.x" [attr.y1]="s.box.y" [attr.x2]="s.box.x + s.box.width" [attr.y2]="s.box.y" />
    } @else {
      <svg:line class="recharts-cartesian-axis-line" stroke="#666" fill="none" [attr.x1]="s.box.x + s.box.width" [attr.y1]="s.box.y" [attr.x2]="s.box.x + s.box.width" [attr.y2]="s.box.y + s.box.height" />
    }
    <svg:g class="recharts-cartesian-axis-ticks">
      @for (t of s.ticks; track $index) {
        <svg:g class="recharts-layer recharts-cartesian-axis-tick">
          @if (s.orient === 'bottom') {
            <svg:line class="recharts-cartesian-axis-tick-line" stroke="#666" fill="none" [attr.x1]="t.coord" [attr.y1]="s.box.y + 6" [attr.x2]="t.coord" [attr.y2]="s.box.y" />
            @if (s.wrap) {
              <svg:text [attr.x]="t.tickCoord" [attr.y]="s.box.y + 8 + 10" text-anchor="middle" font-size="10" font-weight="600" fill="#334155">
                @for (l of t.lines; track $index) { <svg:tspan [attr.x]="t.tickCoord" [attr.dy]="$index ? 12 : 0">{{ l }}</svg:tspan> }
              </svg:text>
            } @else {
              <svg:text class="recharts-text recharts-cartesian-axis-tick-value" [attr.x]="t.tickCoord" [attr.y]="s.box.y + 8" text-anchor="middle" stroke="none"
                [attr.fill]="s.fill" [attr.font-size]="s.fontSize" [attr.font-weight]="s.fontWeight"><svg:tspan [attr.x]="t.tickCoord" dy="0.71em">{{ t.label }}</svg:tspan></svg:text>
            }
          } @else {
            <svg:line class="recharts-cartesian-axis-tick-line" stroke="#666" fill="none" [attr.x1]="s.box.x + s.box.width - 6" [attr.y1]="t.coord" [attr.x2]="s.box.x + s.box.width" [attr.y2]="t.coord" />
            <svg:text class="recharts-text recharts-cartesian-axis-tick-value" [attr.x]="s.box.x + s.box.width - 8" [attr.y]="t.tickCoord" text-anchor="end" stroke="none"
              [attr.fill]="s.fill" [attr.font-size]="s.fontSize" [attr.font-weight]="s.fontWeight"><svg:tspan [attr.x]="s.box.x + s.box.width - 8" dy="0.355em">{{ t.label }}</svg:tspan></svg:text>
          }
        </svg:g>
      }
    </svg:g>
    @if (s.label) { <svg:g [dsText]="s.label" /> }
  `,
})
export class SvgAxis {
  readonly a = input.required<AxisSpec>({ alias: 'dsAxis' });
}

/** Lignes horizontales de la grille (CartesianGrid vertical={false}). */
@Component({
  selector: 'g[dsGrid]',
  host: { class: 'recharts-cartesian-grid' },
  template: `
    <svg:g class="recharts-cartesian-grid-horizontal">
      @for (y of ys(); track $index) {
        <svg:line stroke="#E2E8F0" stroke-dasharray="3 3" fill="none" [attr.x1]="plot().x" [attr.y1]="y" [attr.x2]="plot().x + plot().width" [attr.y2]="y" />
      }
    </svg:g>
  `,
})
export class SvgGrid {
  readonly plot = input.required<Box>({ alias: 'dsGrid' });
  readonly ys = input.required<number[]>();
}

// ---------------------------------------------------------------- Info-bulle
/** Boîte d'info-bulle positionnée comme TooltipBoundingBox (offset 10, sans sortir de la zone du graphique). */
@Component({
  selector: 'ds-chart-tooltip',
  host: { style: 'display: contents' },
  template: `
    <div #box class="recharts-tooltip-wrapper" tabindex="-1"
      style="pointer-events: none; position: absolute; top: 0px; left: 0px"
      [style.visibility]="visible() ? 'visible' : 'hidden'" [style.transform]="transform()" [style.transition]="animated() ? 'transform 400ms ease' : null">
      @if (coord()) { <ng-content /> }
    </div>
  `,
})
export class ChartTooltip {
  readonly coord = input<{ x: number; y: number } | null>(null);
  readonly viewBox = input.required<Box>();
  private box = viewChild.required<ElementRef<HTMLDivElement>>('box');
  private destroyRef = inject(DestroyRef);
  private size = signal({ w: 0, h: 0 });
  private last = signal<{ x: number; y: number } | null>(null);
  protected animated = signal(false);

  constructor() {
    // taille de la boîte via ResizeObserver : la lire (offsetWidth) après chaque rendu forçait
    // une mise en page synchrone de toute la page à chaque mouvement de souris
    afterNextRender(() => {
      const ro = new ResizeObserver(([entry]) => {
        const b = entry.borderBoxSize?.[0];
        const w = b ? b.inlineSize : (entry.target as HTMLElement).offsetWidth;
        const h = b ? b.blockSize : (entry.target as HTMLElement).offsetHeight;
        const s = untracked(this.size);
        if (s.w !== w || s.h !== h) this.size.set({ w, h });
      });
      ro.observe(this.box().nativeElement);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
    effect(() => {
      const p = this.pos();
      if (p) untracked(() => { if (this.last()) this.animated.set(true); this.last.set(p); });
    });
  }

  protected visible = computed(() => !!this.coord() && this.size().w > 0 && this.size().h > 0);
  private pos = computed(() => {
    const c = this.coord();
    const { w, h } = this.size();
    const vb = this.viewBox();
    if (!c || !w || !h) return null;
    const at = (key: 'x' | 'y', dim: number, vbDim: number) => {
      const negative = c[key] - dim - 10, positive = c[key] + 10;
      if (positive + dim > vb[key] + vbDim) return Math.max(negative, vb[key]);
      return Math.max(positive, vb[key]);
    };
    return { x: at('x', w, vb.width), y: at('y', h, vb.height) };
  });
  protected transform = computed(() => { const p = this.pos() ?? this.last(); return p ? `translate(${p.x}px, ${p.y}px)` : null; });
}

export interface TipItem { name?: string; value: string; color: string }

/** Contenu par défaut de l'info-bulle (DefaultTooltipContent + contentStyle { borderRadius: 12, fontSize: 12 }). */
@Component({
  selector: 'ds-default-tooltip',
  host: { style: 'display: contents' },
  template: `
    <div class="recharts-default-tooltip" style="margin: 0px; padding: 10px; background-color: rgb(255, 255, 255); border: 1px solid rgb(204, 204, 204); white-space: nowrap; border-radius: 12px; font-size: 12px">
      <p class="recharts-tooltip-label" style="margin: 0px">{{ label() }}</p>
      <ul class="recharts-tooltip-item-list" style="padding: 0px; margin: 0px">
        @for (it of items(); track $index) {
          <li class="recharts-tooltip-item" style="display: block; padding-top: 4px; padding-bottom: 4px" [style.color]="it.color">
            @if (it.name !== undefined) {<span class="recharts-tooltip-item-name">{{ it.name }}</span><span class="recharts-tooltip-item-separator">{{ ' : ' }}</span>}<span class="recharts-tooltip-item-value">{{ it.value }}</span><span class="recharts-tooltip-item-unit"></span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class DefaultTooltip {
  readonly label = input<string>('');
  readonly items = input<TipItem[]>([]);
}

// ---------------------------------------------------------------- Base des graphiques
/** Conteneur « responsive » : mesure la largeur disponible et suit la souris. */
@Directive()
export abstract class ChartBase {
  protected wrap = viewChild<ElementRef<HTMLDivElement>>('wrap');
  protected width = signal(0);
  protected mouse = signal<{ x: number; y: number } | null>(null);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.wrap()?.nativeElement;
      if (!el) return;
      const ro = new ResizeObserver(() => this.width.set(Math.floor(el.clientWidth)));
      ro.observe(el);
      this.width.set(Math.floor(el.clientWidth));
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  protected onMove(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.mouse.set({ x: e.clientX - r.left, y: e.clientY - r.top });
  }
  protected onLeave() { this.mouse.set(null); }
}

export function inBox(m: { x: number; y: number } | null, b: Box) {
  return !!m && m.x >= b.x && m.x <= b.x + b.width && m.y >= b.y && m.y <= b.y + b.height;
}

/** Index du point de données le plus proche en x. */
export function nearestIndex(xs: number[], x: number) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < xs.length; i++) { const d = Math.abs(xs[i] - x); if (d < bd) { bd = d; best = i; } }
  return best;
}
