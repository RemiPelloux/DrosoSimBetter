import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { Paintbrush, Square, PaintBucket, Eraser, MousePointer2, Trash2, Scissors, Pencil, Check, LayoutTemplate, X, Maximize2, Minimize2, type IconNode } from 'lucide';
import { gridStore, select, parcelsSig, GRID_N, type CellType, type Tool, type TemplateId } from '@/lib/store';
import { TYPE_LABEL, isCherry } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { IconForest, IconCherry } from '@/components/icons';
import { Lucide } from '../ui/lucide';
import { Motion, LayoutId } from '../ui/motion';
import { AutoFocus } from '../ui/autofocus';
import { MenuBtn } from './menu-btn.component';
import { TemplateThumb } from './template-thumb.component';
import { CELL_BG } from './grid-editor.utils';

const NC = GRID_N * GRID_N;
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

// ------------------------------------------------------------------ Éditeur de grille
@Component({
  selector: 'ds-grid-editor',
  imports: [Lucide, Motion, LayoutId, AutoFocus, MenuBtn, TemplateThumb, IconForest, IconCherry],
  host: { style: 'display: contents', '(window:keydown)': 'onKey($event)' },
  templateUrl: './grid-editor.component.html',
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
