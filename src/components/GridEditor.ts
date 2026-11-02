import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import {
  Paintbrush, Square, PaintBucket, Eraser, MousePointer2, Trash2, Scissors, Pencil, Check,
  LayoutTemplate, X, Maximize2, Minimize2, type IconNode,
} from 'lucide';
import { gridStore, select, parcelsSig, buildTemplate, GRID_N, type CellType, type Tool, type TemplateId } from '@/lib/store';
import { TYPE_LABEL, isCherry } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { IconForest, IconCherry } from '@/components/icons';
import { Lucide } from './ui/lucide';
import { Motion, LayoutId } from './ui/motion';
import { AutoFocus } from './ui/autofocus';

const NC = GRID_N * GRID_N;
export const CELL_BG: Record<CellType, string> = {
  neutral: '#F1F5F9', forest: '#15803D', 'early-cherry': '#D97706', 'late-cherry': '#991B1B', 'season-cherry': '#E11D48',
};
const PALETTE: CellType[] = ['forest', 'early-cherry', 'season-cherry', 'late-cherry'];
const SHORT: Record<CellType, string> = { neutral: 'Neutre', forest: 'Forêt', 'early-cherry': 'Précoce', 'season-cherry': 'Saison', 'late-cherry': 'Tardive' };

const TOOLS: { id: Tool; label: string; icon: IconNode; key: string; hint: string }[] = [
  { id: 'brush', label: 'Pinceau', icon: Paintbrush, key: 'B', hint: 'Cliquer-glisser pour peindre' },
  { id: 'rectangle', label: 'Zone', icon: Square, key: 'R', hint: 'Tracer un rectangle plein' },
  { id: 'fill', label: 'Remplir', icon: PaintBucket, key: 'F', hint: 'Remplir une zone contiguë' },
  { id: 'eraser', label: 'Gomme', icon: Eraser, key: 'E', hint: 'Effacer (ou clic droit)' },
  { id: 'select', label: 'Éditer', icon: MousePointer2, key: 'V', hint: 'Cliquer une case pour la modifier' },
];

const TEMPLATES: { id: TemplateId; label: string; desc: string }[] = [
  { id: 'mixed', label: 'Verger mixte', desc: 'Précoce + Tardive, forêt au Nord' },
  { id: 'enclosed', label: 'Verger enclavé', desc: 'Haies sauvages sur 4 côtés' },
  { id: 'plain', label: 'Plaine arboricole', desc: 'Sans zone refuge' },
  { id: 'blank', label: 'Page blanche', desc: 'Tout effacer' },
];

function floodIndices(grid: CellType[], start: number) {
  const t = grid[start];
  const seen = new Uint8Array(NC);
  const out: number[] = [];
  const q = [start]; seen[start] = 1;
  while (q.length) {
    const c = q.pop()!; out.push(c);
    const x = c % GRID_N, y = (c / GRID_N) | 0;
    for (const n of [x > 0 ? c - 1 : -1, x < GRID_N - 1 ? c + 1 : -1, y > 0 ? c - GRID_N : -1, y < GRID_N - 1 ? c + GRID_N : -1])
      if (n >= 0 && !seen[n] && grid[n] === t) { seen[n] = 1; q.push(n); }
  }
  return out;
}
function rectIndices(a: number, b: number) {
  const x0 = Math.min(a % GRID_N, b % GRID_N), x1 = Math.max(a % GRID_N, b % GRID_N);
  const y0 = Math.min((a / GRID_N) | 0, (b / GRID_N) | 0), y1 = Math.max((a / GRID_N) | 0, (b / GRID_N) | 0);
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * GRID_N + x);
  return out;
}

function lineCells(a: number, b: number) {
  let x0 = a % GRID_N, y0 = (a / GRID_N) | 0;
  const x1 = b % GRID_N, y1 = (b / GRID_N) | 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: number[] = [];
  for (;;) {
    out.push(y0 * GRID_N + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}
function stamp(c: number, size: number) {
  if (size <= 1) return [c];
  const x = c % GRID_N, y = (c / GRID_N) | 0;
  const lo = size === 2 ? 0 : -1, hi = 1; // 2×2 ou 3×3 centré
  const out: number[] = [];
  for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < GRID_N && ny < GRID_N) out.push(ny * GRID_N + nx);
  }
  return out;
}

type Stroke = { cells: Set<number>; type: CellType; start: number; last: number; rectEnd?: number; moved: boolean };

// ------------------------------------------------------------------ Bouton du menu d'édition
@Component({
  selector: 'ds-menu-btn',
  imports: [Lucide],
  host: { style: 'display: contents' },
  template: `
    <button (click)="press.emit()" [class]="cn('flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold', danger() ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100')">
      <svg [lucide]="icon()" class="h-3.5 w-3.5"></svg> <ng-content />
    </button>
  `,
})
class MenuBtn {
  readonly icon = input.required<IconNode>();
  readonly danger = input(false);
  readonly press = output<void>();
  protected cn = cn;
}

// ------------------------------------------------------------------ Vignette de modèle
@Component({
  selector: 'ds-template-thumb',
  host: { '[attr.id]': 'null', style: 'display: contents' },
  template: `
    <div class="grid shrink-0 overflow-hidden rounded-md border border-slate-200" [style.width.px]="size()" [style.height.px]="size()" [style.grid-template-columns]="cols">
      @for (t of g(); track $index) { <div [style.background-color]="bg[t]"></div> }
    </div>
  `,
})
export class TemplateThumb {
  readonly id = input.required<TemplateId>();
  readonly size = input(40);
  protected g = computed(() => buildTemplate(this.id()));
  protected bg = CELL_BG;
  protected cols = `repeat(${GRID_N}, 1fr)`;
}

// ------------------------------------------------------------------ Mini-carte
@Component({
  selector: 'ds-mini-map',
  host: { style: 'display: contents' },
  template: `
    <div class="grid overflow-hidden rounded-lg border border-slate-200" [style.width.px]="size()" [style.height.px]="size()" [style.grid-template-columns]="cols">
      @for (c of cells(); track $index) {
        @if (c.plain) { <div [class]="c.cls" [style.background-color]="c.bg"></div> }
        @else { <div [title]="c.title" [style.background-color]="c.bg" [style.box-shadow]="c.shadow"></div> }
      }
    </div>
  `,
})
export class MiniMap {
  readonly grid = input.required<CellType[]>();
  readonly values = input<Float32Array | number[]>();
  readonly max = input<number>();
  readonly size = input(200);
  protected cols = `repeat(${GRID_N}, 1fr)`;
  protected cells = computed(() => {
    const values = this.values(), max = this.max();
    return this.grid().map((t, i) => {
      if (!values) return { plain: true, cls: t === 'forest' ? 'hatch' : '', bg: CELL_BG[t], title: '', shadow: null };
      const v = Math.min(1, (values[i] ?? 0) / (max || 1));
      return { plain: false, cls: '', bg: heat(v), title: `${Math.round(values[i] ?? 0).toLocaleString('fr-FR')} femelles/ha`, shadow: t !== 'neutral' ? `inset 0 0 0 1px ${CELL_BG[t]}55` : null };
    });
  });
}

export function heat(v: number) {
  // vert → jaune → orange → rouge
  const stops = [[240, 253, 244], [253, 224, 71], [249, 115, 22], [185, 28, 28]];
  const x = Math.max(0, Math.min(1, v)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const c = stops[i].map((s, k) => Math.round(s + (stops[i + 1][k] - s) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ------------------------------------------------------------------ Éditeur de grille
@Component({
  selector: 'ds-grid-editor',
  imports: [Lucide, Motion, LayoutId, AutoFocus, MenuBtn, TemplateThumb, IconForest, IconCherry],
  host: { style: 'display: contents', '(window:keydown)': 'onKey($event)' },
  template: `
    <div class="@container flex flex-col gap-3">
      <!-- Barre d'outils — rangée 1 : outils + actions -->
      <div class="flex items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-0.5 rounded-2xl bg-slate-100 p-1" role="toolbar" aria-label="Outils de dessin">
          @for (t of tools; track t.id) {
            <button (click)="store.setActiveTool(t.id)" [title]="t.label + ' — ' + t.hint + ' (' + t.key + ')'" [attr.aria-pressed]="activeTool() === t.id"
              [class]="cn('relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-xs font-bold transition-colors',
                activeTool() === t.id ? 'text-white' : 'text-slate-600 hover:text-slate-900')">
              @if (activeTool() === t.id) { <span [layoutId]="'tool-' + variant()" [layoutTransition]="{ type: 'spring', stiffness: 500, damping: 38 }" class="absolute inset-0 rounded-xl bg-slate-900 shadow"></span> }
              <svg [lucide]="t.icon" class="relative h-4 w-4 shrink-0"></svg><span class="relative hidden truncate @2xl:inline">{{ t.label }}</span>
              <kbd [class]="cn('relative hidden rounded px-1 text-[9px] font-semibold @4xl:inline', activeTool() === t.id ? 'bg-white/15 text-white/80' : 'bg-white text-slate-400')">{{ t.key }}</kbd>
            </button>
          }
        </div>
        <div class="relative shrink-0">
          <button (click)="showTemplates.set(!showTemplates())" title="Modèles de verger" class="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <svg [lucide]="I.LayoutTemplate" class="h-4 w-4"></svg><span class="hidden @3xl:inline">Modèles</span>
          </button>
          @if (showTemplates()) {
            <div motion [initial]="{ opacity: 0, y: -6 }" [animate]="{ opacity: 1, y: 0 }" [exit]="{ opacity: 0, y: -6 }"
              class="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              @for (t of templates; track t.id) {
                <button (click)="store.loadTemplate(t.id); showTemplates.set(false)"
                  class="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50">
                  <ds-template-thumb [id]="t.id" />
                  <div><div class="text-xs font-bold text-slate-800">{{ t.label }}</div><div class="text-[11px] text-slate-500">{{ t.desc }}</div></div>
                </button>
              }
            </div>
          }
        </div>
        <button (click)="store.setEditorFullscreen(!full())" [title]="full() ? 'Réduire (Échap)' : 'Agrandir en plein écran (Maj+F)'"
          class="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-800">
          @if (full()) { <svg [lucide]="I.Minimize2" class="h-4 w-4"></svg> } @else { <svg [lucide]="I.Maximize2" class="h-4 w-4"></svg> }<span class="hidden @3xl:inline">{{ full() ? 'Réduire' : 'Agrandir' }}</span>
        </button>
      </div>

      <!-- Rangée 2 : palette + taille du pinceau -->
      <div class="flex items-stretch gap-2">
        <div class="grid min-w-0 flex-1 grid-cols-4 gap-1.5">
          @for (t of palette; track t; let i = $index) {
            @let on = activeCellType() === t && activeTool() !== 'eraser';
            <button (click)="store.setActiveCellType(t)" [title]="typeLabel[t] + ' (touche ' + (i + 1) + ')'" [attr.data-on]="on"
              [class]="cn('ico-host press flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1.5 py-1.5 text-center transition-all @xl:flex-row @xl:gap-2 @xl:px-2 @xl:text-left',
                on ? 'border-slate-900 bg-white shadow-md ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-slate-300')">
              <span [class]="cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-inner', t === 'forest' && 'hatch')" [style.background-color]="bg[t]">
                @if (t === 'forest') { <ds-icon-forest className="h-4.5 w-4.5" /> } @else { <ds-icon-cherry className="h-4.5 w-4.5" /> }
              </span>
              <span class="min-w-0 leading-tight">
                <span class="block text-[11px] font-bold text-slate-800">{{ short[t] }}</span>
                <span class="hidden text-[9px] text-slate-400 @3xl:block">touche {{ i + 1 }}</span>
              </span>
            </button>
          }
        </div>
        @if (activeTool() === 'brush' || activeTool() === 'eraser') {
          <div class="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 @xl:flex-row" title="Taille du pinceau ([ / ])">
            @for (n of sizes; track n) {
              <button (click)="store.setBrushSize(n)" [attr.aria-label]="'Pinceau ' + n + '×' + n"
                [class]="cn('flex h-6 w-7 items-center justify-center rounded-lg @xl:h-8 @xl:w-8', brushSize() === n ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')">
                <span [class]="cn('rounded-[3px]', brushSize() === n ? 'bg-white' : 'bg-slate-500')" [style.width.px]="4 + n * 3" [style.height.px]="4 + n * 3"></span>
              </button>
            }
          </div>
        }
      </div>

      <!-- Grille -->
      <div class="relative mx-auto w-full" [style.max-width]="maxWidth()">
        <div #gridEl
          class="relative grid aspect-square w-full touch-none select-none overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-inner"
          [style.grid-template-columns]="cols" [style.cursor]="activeTool() === 'select' ? 'pointer' : 'crosshair'"
          (pointerdown)="onPointerDown($event)" (pointermove)="onPointerMove($event)" (pointerup)="onPointerUp($event)"
          (pointerleave)="hover.set(null)" (contextmenu)="$event.preventDefault()">
          @for (c of cellLayer(); track c.key) {
            <div [class]="c.cls" [style.background-color]="c.bg" [style.box-shadow]="c.shadow" [style.opacity]="c.opacity">
              @if (c.selected) { <div class="pointer-events-none absolute inset-0 bg-white/30"></div> }
            </div>
          }
          <!-- étiquettes des parcelles (placement intelligent, sans chevauchement) -->
          @for (l of labels(); track l.id) {
            <div class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-slate-800 shadow ring-1 ring-black/5" [style.left.%]="l.x" [style.top.%]="l.y">
              {{ l.text }}
            </div>
          }
          @for (c of hoverCells(); track c) {
            <div class="pointer-events-none absolute ring-2 ring-inset ring-slate-900/80"
              [style.left.%]="(c % gridN) * 5" [style.top.%]="floor(c / gridN) * 5" style="width: 5%; height: 5%" [style.background-color]="hoverBg()"></div>
          }
          @if (rectInfo(); as r) {
            <div class="pointer-events-none absolute left-2 top-2 rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] font-bold text-white shadow">
              {{ r.w }} × {{ r.h }} cases · {{ (r.w * r.h * haPerCell()).toFixed(2) }} ha
            </div>
          }
        </div>

        <!-- Menu contextuel flottant -->
        @if (menu(); as m) {
          @if (menuParcel(); as mp) {
            <div motion [initial]="{ opacity: 0, scale: 0.95 }" [animate]="{ opacity: 1, scale: 1 }" [exit]="{ opacity: 0, scale: 0.95 }"
              class="absolute z-40 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
              [style.left.px]="min(m.x, 300)" [style.top.px]="m.y + 12">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-bold text-slate-800">{{ mp.name }}</span>
                <button (click)="menu.set(null)" class="rounded p-0.5 text-slate-400 hover:bg-slate-100"><svg [lucide]="I.X" class="h-3.5 w-3.5"></svg></button>
              </div>
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Changer cette case</p>
              <div class="mb-2 grid grid-cols-4 gap-1">
                @for (t of palette; track t) {
                  <button [title]="typeLabel[t]" (click)="store.paint([m.cell], t); menu.set(null)"
                    [class]="cn('h-7 rounded-md border-2', grid()[m.cell] === t ? 'border-slate-900' : 'border-transparent', t === 'forest' && 'hatch')" [style.background-color]="bg[t]"></button>
                }
              </div>
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Changer toute la parcelle</p>
              <div class="mb-2 grid grid-cols-4 gap-1">
                @for (t of palette; track t) {
                  <button [title]="typeLabel[t]" (click)="store.paint(mp.cells, t); menu.set(null)"
                    [class]="cn('h-7 rounded-md border-2', mp.type === t ? 'border-slate-900' : 'border-transparent', t === 'forest' && 'hatch')" [style.background-color]="bg[t]"></button>
                }
              </div>
              <div class="grid grid-cols-2 gap-1">
                <ds-menu-btn [icon]="I.Scissors" (press)="split('h')">Scinder ↔</ds-menu-btn>
                <ds-menu-btn [icon]="I.Scissors" (press)="split('v')">Scinder ↕</ds-menu-btn>
                <ds-menu-btn [icon]="I.Eraser" (press)="store.paint([m.cell], 'neutral'); menu.set(null)">Effacer case</ds-menu-btn>
                <ds-menu-btn [icon]="I.Trash2" [danger]="true" (press)="store.paint(mp.cells, 'neutral'); menu.set(null)">Suppr. parcelle</ds-menu-btn>
              </div>
            </div>
          }
        }
      </div>

      <div class="flex min-h-[28px] items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">
        @if (hoverInfo(); as h) {
          <span class="flex items-center gap-1.5 truncate">
            <span class="font-mono font-bold text-slate-700">{{ colLetter(h.x) }}{{ h.y }}</span>
            <span [class]="cn('h-2.5 w-2.5 rounded-sm', h.type === 'forest' && 'hatch')" [style.background-color]="bg[h.type]"></span>
            @if (h.parcel) { <b class="truncate text-slate-700">{{ h.parcel.name }} · {{ (h.parcel.area * haPerCell()).toFixed(2) }} ha</b> } @else { Zone neutre }
          </span>
        } @else {
          <span class="truncate"><b>Glisser</b> pour peindre · <span class="hidden sm:inline"><b>clic droit</b> pour gommer</span><span class="sm:hidden">outil <b>Gomme</b> pour effacer</span></span>
        }
        <span class="shrink-0 rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">{{ (paintedCells() * haPerCell()).toFixed(2) }} ha</span>
      </div>

      <!-- Liste des parcelles -->
      @if (!compact()) {
        <div class="rounded-xl border border-slate-200 bg-white">
          <div class="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Parcelles ({{ parcels().length }})</span>
            <span class="text-[11px] text-slate-400">1 case = {{ economics().cellAreaM2 }} m²</span>
          </div>
          @if (parcels().length === 0) { <p class="p-4 text-center text-xs italic text-slate-400">Dessinez ou choisissez un modèle pour commencer.</p> }
          <ul class="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            @for (p of parcels(); track p.id) {
              <li (click)="store.selectParcel(p.id === selectedParcelId() ? null : p.id)"
                [class]="cn('flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50', p.id === selectedParcelId() && 'bg-slate-100')">
                <span [class]="cn('h-4 w-4 shrink-0 rounded', p.type === 'forest' && 'hatch')" [style.background-color]="p.color"></span>
                @if (p.type === 'forest') { <ds-icon-forest className="h-3.5 w-3.5 text-slate-400" /> } @else if (isCherry(p.type)) { <ds-icon-cherry className="h-3.5 w-3.5 text-slate-400" /> }
                @if (editing() === p.id) {
                  <form class="flex flex-1 gap-1" (submit)="$event.preventDefault(); commitRename(p.id, p.name)" (click)="$event.stopPropagation()">
                    <input autoFocus [value]="draft()" (input)="draft.set($any($event.target).value)" (blur)="commitRename(p.id, p.name)"
                      class="flex-1 rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                    <button type="submit" class="rounded bg-slate-900 p-1 text-white"><svg [lucide]="I.Check" class="h-3 w-3"></svg></button>
                  </form>
                } @else {
                  <span class="flex-1 truncate font-semibold text-slate-700">{{ p.name }}</span>
                  <span class="font-mono text-[11px] text-slate-500">{{ (p.area * haPerCell()).toFixed(2) }} ha</span>
                  <button (click)="$event.stopPropagation(); editing.set(p.id); draft.set(p.name)" class="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Renommer">
                    <svg [lucide]="I.Pencil" class="h-3 w-3"></svg>
                  </button>
                }
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class GridEditor {
  readonly compact = input(false);
  readonly variant = input<'panel' | 'fullscreen'>('panel');

  protected I = { LayoutTemplate, Minimize2, Maximize2, X, Scissors, Eraser, Trash2, Check, Pencil };
  protected cn = cn;
  protected isCherry = isCherry;
  protected store = gridStore.getState();
  protected tools = TOOLS;
  protected templates = TEMPLATES;
  protected palette = PALETTE;
  protected short = SHORT;
  protected typeLabel = TYPE_LABEL;
  protected bg = CELL_BG;
  protected sizes = [1, 2, 3] as const;
  protected gridN = GRID_N;
  protected cols = `repeat(${GRID_N}, 1fr)`;
  protected floor = Math.floor;
  protected min = Math.min;
  protected colLetter = (x: number) => String.fromCharCode(64 + x);

  protected brushSize = select(s => s.brushSize);
  protected grid = select(s => s.grid);
  protected activeTool = select(s => s.activeTool);
  protected activeCellType = select(s => s.activeCellType);
  protected selectedParcelId = select(s => s.selectedParcelId);
  protected economics = select(s => s.economics);
  protected parcels = parcelsSig;
  protected full = computed(() => this.variant() === 'fullscreen');

  private gridRef = viewChild.required<ElementRef<HTMLDivElement>>('gridEl');
  protected stroke = signal<Stroke | null>(null);
  protected menu = signal<{ cell: number; x: number; y: number } | null>(null);
  protected hover = signal<number | null>(null);
  protected showTemplates = signal(false);
  protected editing = signal<string | null>(null);
  protected draft = signal('');
  private gridPx = signal(500);

  // index O(1) : parcelle par identifiant (survol, menu d'édition) et nombre de cases peintes
  private parcelById = computed(() => new Map(this.parcels().map(p => [p.id, p])));
  protected paintedCells = computed(() => this.grid().reduce((n, c) => n + (c !== 'neutral' ? 1 : 0), 0));
  private cellParcel = computed(() => {
    const m = new Array<string | null>(NC).fill(null);
    this.parcels().forEach(p => p.cells.forEach(c => (m[c] = p.id)));
    return m;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const ro = new ResizeObserver(es => this.gridPx.set(es[0].contentRect.width));
      ro.observe(this.gridRef().nativeElement);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  protected maxWidth = computed(() => this.compact() ? '420px' : this.full() ? 'min(100%, calc(100vh - 260px))' : 'min(100%, calc(100vh - 250px), 900px)');

  protected labels = computed(() => {
    const gridPx = this.gridPx();
    const placed: { id: string; x: number; y: number; text: string; w: number; h: number }[] = [];
    const cell = gridPx / GRID_N;
    const sorted = [...this.parcels()].filter(p => p.cells.length >= 4).sort((a, b) => b.cells.length - a.cells.length);
    for (const p of sorted) {
      const set = new Set(p.cells);
      const xs = p.cells.map(c => c % GRID_N), ys = p.cells.map(c => (c / GRID_N) | 0);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const textW = Math.min(p.name.length * 6 + 14, gridPx * 0.6);
      let best: { x: number; y: number; score: number } | null = null;
      for (const c of p.cells) {
        const x = c % GRID_N, y = (c / GRID_N) | 0;
        // distance au bord de la parcelle (Chebyshev, limitée à 3)
        let d = 0;
        outer: for (let r = 1; r <= 3; r++) {
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= GRID_N || ny >= GRID_N) continue;
            if (!set.has(ny * GRID_N + nx)) break outer;
          }
          d = r;
        }
        // longueur du segment horizontal contenant la case
        let l = x, r2 = x;
        while (l > 0 && set.has(y * GRID_N + l - 1)) l--;
        while (r2 < GRID_N - 1 && set.has(y * GRID_N + r2 + 1)) r2++;
        const run = r2 - l + 1;
        const fits = run * cell >= textW ? 6 : 0;
        const score = d * 3 + Math.min(run, 12) * 0.6 + fits - Math.hypot(x - mx, y - my) * 0.15;
        if (!best || score > best.score) best = { x: ((l + r2 + 1) / 2 / GRID_N) * 100, y: ((y + 0.5) / GRID_N) * 100, score };
      }
      if (!best) continue;
      const w = (textW / gridPx) * 100, h = (20 / gridPx) * 100;
      const b = best;
      const hit = placed.some(q => Math.abs(q.x - b.x) < (q.w + w) / 2 + 1 && Math.abs(q.y - b.y) < (q.h + h) / 2 + 0.5);
      if (!hit) placed.push({ id: p.id, x: Math.min(100 - w / 2, Math.max(w / 2, b.x)), y: b.y, text: p.name, w, h });
    }
    return placed;
  });

  private cellFromEvent(e: { clientX: number; clientY: number }) {
    const r = this.gridRef().nativeElement.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * GRID_N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * GRID_N);
    if (x < 0 || y < 0 || x >= GRID_N || y >= GRID_N) return -1;
    return y * GRID_N + x;
  }

  // aperçu : cellules du trait/rectangle en cours
  private preview = computed(() => {
    const stroke = this.stroke();
    if (!stroke) return null;
    if (this.activeTool() === 'rectangle' && stroke.rectEnd !== undefined && stroke.type !== 'neutral') return new Set(rectIndices(stroke.start, stroke.rectEnd));
    return stroke.cells;
  });

  protected onPointerDown(e: PointerEvent) {
    const c = this.cellFromEvent(e);
    if (c < 0) return;
    e.preventDefault();
    this.menu.set(null);
    const activeTool = this.activeTool();
    const grid = this.grid();
    const erase = e.button === 2 || activeTool === 'eraser';
    if (activeTool === 'select' && !erase) {
      if (grid[c] !== 'neutral') { this.openMenu(c, e); this.store.selectParcel(this.cellParcel()[c]); }
      return;
    }
    if (activeTool === 'fill' && !erase) { this.store.paint(floodIndices(grid, c), this.activeCellType()); return; }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.stroke.set({ cells: new Set(stamp(c, this.brushSize())), type: erase ? 'neutral' : this.activeCellType(), start: c, last: c, rectEnd: c, moved: false });
  }

  protected onPointerMove(e: PointerEvent) {
    const c = this.cellFromEvent(e);
    this.hover.set(c >= 0 ? c : null);
    const stroke = this.stroke();
    if (!stroke || c < 0) return;
    if (this.activeTool() === 'rectangle' && stroke.type !== 'neutral') {
      if (c !== stroke.rectEnd) this.stroke.set({ ...stroke, rectEnd: c, moved: true });
    } else if (c !== stroke.last) {
      const cells = new Set(stroke.cells);
      for (const l of lineCells(stroke.last, c)) for (const k of stamp(l, this.brushSize())) cells.add(k); // interpolation : aucun trou même en geste rapide
      this.stroke.set({ ...stroke, cells, last: c, moved: true });
    }
  }

  protected onPointerUp(e: PointerEvent) {
    const stroke = this.stroke();
    if (!stroke) return;
    const preview = this.preview();
    const cells = preview ? [...preview] : [];
    // clic simple sur une case déjà de ce type → ouvrir le menu d'édition
    if (!stroke.moved && this.brushSize() === 1 && stroke.type !== 'neutral' && this.grid()[stroke.start] === stroke.type) {
      this.openMenu(stroke.start, e); this.store.selectParcel(this.cellParcel()[stroke.start]);
    } else this.store.paint(cells, stroke.type); // 1 seule entrée d'historique par geste
    this.stroke.set(null);
  }

  private openMenu(cell: number, e: { clientX: number; clientY: number }) {
    const r = this.gridRef().nativeElement.getBoundingClientRect();
    this.menu.set({ cell, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  protected onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const st = gridStore.getState();
    if (e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); st.setEditorFullscreen(!st.editorFullscreen); return; }
    if (e.key === '[') st.setBrushSize(Math.max(1, st.brushSize - 1) as 1 | 2 | 3);
    if (e.key === ']') st.setBrushSize(Math.min(3, st.brushSize + 1) as 1 | 2 | 3);
    const t = TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
    if (t && !e.shiftKey) st.setActiveTool(t.id);
    if (['1', '2', '3', '4'].includes(e.key)) st.setActiveCellType(PALETTE[+e.key - 1]);
    if (e.key === 'Escape') { this.menu.set(null); st.selectParcel(null); if (gridStore.getState().editorFullscreen) gridStore.getState().setEditorFullscreen(false); }
  }

  protected cellLayer = computed(() => {
    const preview = this.preview(), stroke = this.stroke(), cellParcel = this.cellParcel(), selectedParcelId = this.selectedParcelId();
    return this.grid().map((t, i) => {
      const type = preview?.has(i) && stroke ? stroke.type : t;
      const pid = cellParcel[i];
      const x = i % GRID_N, y = (i / GRID_N) | 0;
      const diff = (n: number) => n < 0 || cellParcel[n] !== pid;
      const b = pid && !preview?.has(i) ? [
        y === 0 || diff(i - GRID_N) ? 'inset 0 2px 0 rgba(15,23,42,.55)' : '',
        x === GRID_N - 1 || diff(i + 1) ? 'inset -2px 0 0 rgba(15,23,42,.55)' : '',
        y === GRID_N - 1 || diff(i + GRID_N) ? 'inset 0 -2px 0 rgba(15,23,42,.55)' : '',
        x === 0 || diff(i - 1) ? 'inset 2px 0 0 rgba(15,23,42,.55)' : '',
      ].filter(Boolean).join(',') : '';
      return {
        key: `${i}-${type}`, // la clé inclut le type : la case est recréée (animation cell-pop) quand il change
        cls: cn('relative border-[0.5px] border-white/40', type === 'forest' && 'hatch', type !== 'neutral' && 'cell-pop'),
        bg: CELL_BG[type], shadow: b || null, opacity: preview?.has(i) ? 0.85 : 1,
        selected: !!pid && pid === selectedParcelId,
      };
    });
  });

  protected haPerCell = computed(() => this.economics().cellAreaM2 / 10000);
  // Aperçu du pinceau sous le curseur + infos de survol
  protected hoverCells = computed(() => {
    const hover = this.hover(), tool = this.activeTool();
    return hover !== null && !this.stroke() && (tool === 'brush' || tool === 'eraser') ? stamp(hover, this.brushSize()) : hover !== null ? [hover] : [];
  });
  protected hoverBg = computed(() => this.activeTool() === 'eraser' ? 'rgba(255,255,255,.45)' : this.activeTool() === 'brush' ? `${CELL_BG[this.activeCellType()]}66` : null);
  protected hoverInfo = computed(() => {
    const hover = this.hover();
    if (hover === null) return null;
    const pid = this.cellParcel()[hover];
    return { x: hover % GRID_N + 1, y: ((hover / GRID_N) | 0) + 1, type: this.grid()[hover], parcel: pid ? this.parcelById().get(pid) : undefined };
  });
  protected rectInfo = computed(() => {
    const stroke = this.stroke();
    return stroke && this.activeTool() === 'rectangle' && stroke.rectEnd !== undefined && stroke.type !== 'neutral'
      ? { w: Math.abs(stroke.rectEnd % GRID_N - stroke.start % GRID_N) + 1, h: Math.abs(((stroke.rectEnd / GRID_N) | 0) - ((stroke.start / GRID_N) | 0)) + 1 } : null;
  });
  protected menuParcel = computed(() => {
    const menu = this.menu();
    const pid = menu ? this.cellParcel()[menu.cell] : null;
    return pid ? this.parcelById().get(pid) ?? null : null;
  });

  protected split(dir: 'h' | 'v') {
    const menu = this.menu(), menuParcel = this.menuParcel();
    if (!menu || !menuParcel) return;
    const x = menu.cell % GRID_N, y = (menu.cell / GRID_N) | 0;
    this.store.paint(menuParcel.cells.filter(c => (dir === 'h' ? ((c / GRID_N) | 0) === y : c % GRID_N === x)), 'neutral');
    this.menu.set(null);
  }

  protected commitRename(id: string, name: string) {
    if (this.editing() !== id) return; // blur après submit : déjà validé
    this.store.renameParcel(id, this.draft().trim() || name);
    this.editing.set(null);
  }
}
