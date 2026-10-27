'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGridStore, useParcels, buildTemplate, GRID_N, type CellType, type Tool, type TemplateId } from '@/lib/store';
import { TYPE_LABEL, isCherry } from '@/lib/engine';
import { cn } from '@/lib/utils';
import {
  Paintbrush, Square, PaintBucket, Eraser, MousePointer2, Trash2, Scissors, Pencil, Check,
  LayoutTemplate, Trees, Cherry, X, Maximize2, Minimize2,
} from 'lucide-react';

const NC = GRID_N * GRID_N;
export const CELL_BG: Record<CellType, string> = {
  neutral: '#F1F5F9', forest: '#15803D', 'early-cherry': '#D97706', 'late-cherry': '#991B1B', 'season-cherry': '#E11D48',
};
const PALETTE: CellType[] = ['forest', 'early-cherry', 'season-cherry', 'late-cherry'];
const SHORT: Record<CellType, string> = { neutral: 'Neutre', forest: 'Forêt', 'early-cherry': 'Précoce', 'season-cherry': 'Saison', 'late-cherry': 'Tardive' };

const TOOLS: { id: Tool; label: string; icon: React.ElementType; key: string; hint: string }[] = [
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

export function GridEditor({ compact = false, variant = 'panel' }: { compact?: boolean; variant?: 'panel' | 'fullscreen' }) {
  const brushSize = useGridStore(s => s.brushSize);
  const setBrushSize = useGridStore(s => s.setBrushSize);
  const setEditorFullscreen = useGridStore(s => s.setEditorFullscreen);
  const full = variant === 'fullscreen';
  const grid = useGridStore(s => s.grid);
  const activeTool = useGridStore(s => s.activeTool);
  const activeCellType = useGridStore(s => s.activeCellType);
  const selectedParcelId = useGridStore(s => s.selectedParcelId);
  const { setActiveTool, setActiveCellType, paint, loadTemplate, selectParcel, renameParcel } = useGridStore.getState();
  const economics = useGridStore(s => s.economics);
  const parcels = useParcels();

  const gridRef = useRef<HTMLDivElement>(null);
  const [stroke, setStroke] = useState<{ cells: Set<number>; type: CellType; start: number; last: number; rectEnd?: number; moved: boolean } | null>(null);
  const [menu, setMenu] = useState<{ cell: number; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // index O(1) : parcelle par identifiant (survol, menu d'édition) et nombre de cases peintes
  const parcelById = useMemo(() => new Map(parcels.map(p => [p.id, p])), [parcels]);
  const paintedCells = useMemo(() => grid.reduce((n, c) => n + (c !== 'neutral' ? 1 : 0), 0), [grid]);
  const cellParcel = useMemo(() => {
    const m = new Array<string | null>(NC).fill(null);
    parcels.forEach(p => p.cells.forEach(c => (m[c] = p.id)));
    return m;
  }, [parcels]);

  const [gridPx, setGridPx] = useState(500);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(es => setGridPx(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const labels = useMemo(() => {
    const placed: { id: string; x: number; y: number; text: string; w: number; h: number }[] = [];
    const cell = gridPx / GRID_N;
    const sorted = [...parcels].filter(p => p.cells.length >= 4).sort((a, b) => b.cells.length - a.cells.length);
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
      const hit = placed.some(q => Math.abs(q.x - best!.x) < (q.w + w) / 2 + 1 && Math.abs(q.y - best!.y) < (q.h + h) / 2 + 0.5);
      if (!hit) placed.push({ id: p.id, x: Math.min(100 - w / 2, Math.max(w / 2, best.x)), y: best.y, text: p.name, w, h });
    }
    return placed;
  }, [parcels, gridPx]);

  const cellFromEvent = useCallback((e: { clientX: number; clientY: number }) => {
    const r = gridRef.current?.getBoundingClientRect();
    if (!r) return -1;
    const x = Math.floor(((e.clientX - r.left) / r.width) * GRID_N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * GRID_N);
    if (x < 0 || y < 0 || x >= GRID_N || y >= GRID_N) return -1;
    return y * GRID_N + x;
  }, []);

  // aperçu : cellules du trait/rectangle en cours
  const preview = useMemo(() => {
    if (!stroke) return null;
    if (activeTool === 'rectangle' && stroke.rectEnd !== undefined && stroke.type !== 'neutral') return new Set(rectIndices(stroke.start, stroke.rectEnd));
    return stroke.cells;
  }, [stroke, activeTool]);

  const onPointerDown = (e: React.PointerEvent) => {
    const c = cellFromEvent(e);
    if (c < 0) return;
    e.preventDefault();
    setMenu(null);
    const erase = e.button === 2 || activeTool === 'eraser';
    if (activeTool === 'select' && !erase) {
      if (grid[c] !== 'neutral') { openMenu(c, e); selectParcel(cellParcel[c]); }
      return;
    }
    if (activeTool === 'fill' && !erase) { paint(floodIndices(grid, c), activeCellType); return; }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setStroke({ cells: new Set(stamp(c, brushSize)), type: erase ? 'neutral' : activeCellType, start: c, last: c, rectEnd: c, moved: false });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = cellFromEvent(e);
    setHover(c >= 0 ? c : null);
    if (!stroke || c < 0) return;
    if (activeTool === 'rectangle' && stroke.type !== 'neutral') {
      if (c !== stroke.rectEnd) setStroke({ ...stroke, rectEnd: c, moved: true });
    } else if (c !== stroke.last) {
      const cells = new Set(stroke.cells);
      for (const l of lineCells(stroke.last, c)) for (const k of stamp(l, brushSize)) cells.add(k); // interpolation : aucun trou même en geste rapide
      setStroke({ ...stroke, cells, last: c, moved: true });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!stroke) return;
    const cells = preview ? [...preview] : [];
    // clic simple sur une case déjà de ce type → ouvrir le menu d'édition
    if (!stroke.moved && brushSize === 1 && stroke.type !== 'neutral' && grid[stroke.start] === stroke.type) {
      openMenu(stroke.start, e); selectParcel(cellParcel[stroke.start]);
    } else paint(cells, stroke.type); // 1 seule entrée d'historique par geste
    setStroke(null);
  };

  function openMenu(cell: number, e: { clientX: number; clientY: number }) {
    const r = gridRef.current!.getBoundingClientRect();
    setMenu({ cell, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); useGridStore.getState().setEditorFullscreen(!useGridStore.getState().editorFullscreen); return; }
      if (e.key === '[') setBrushSize(Math.max(1, useGridStore.getState().brushSize - 1) as 1 | 2 | 3);
      if (e.key === ']') setBrushSize(Math.min(3, useGridStore.getState().brushSize + 1) as 1 | 2 | 3);
      const t = TOOLS.find(t => t.key.toLowerCase() === e.key.toLowerCase());
      if (t && !e.shiftKey) setActiveTool(t.id);
      if (['1', '2', '3', '4'].includes(e.key)) setActiveCellType(PALETTE[+e.key - 1]);
      if (e.key === 'Escape') { setMenu(null); selectParcel(null); if (useGridStore.getState().editorFullscreen) useGridStore.getState().setEditorFullscreen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveTool, setActiveCellType, selectParcel, setBrushSize]);

  const cellLayer = useMemo(() => grid.map((t, i) => {
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
    const selected = pid && pid === selectedParcelId;
    return (
      <div key={i} className={cn('relative border-[0.5px] border-white/40', type === 'forest' && 'hatch')}
        style={{ backgroundColor: CELL_BG[type], boxShadow: b || undefined, opacity: preview?.has(i) ? 0.85 : 1 }}>
        {selected && <div className="pointer-events-none absolute inset-0 bg-white/30" />}
      </div>
    );
  }), [grid, preview, stroke, cellParcel, selectedParcelId]);

  const haPerCell = economics.cellAreaM2 / 10000;
  // Aperçu du pinceau sous le curseur + infos de survol
  const hoverCells = hover !== null && !stroke && (activeTool === 'brush' || activeTool === 'eraser') ? stamp(hover, brushSize) : hover !== null ? [hover] : [];
  const hoverInfo = hover !== null ? { x: hover % GRID_N + 1, y: ((hover / GRID_N) | 0) + 1, type: grid[hover], parcel: cellParcel[hover] ? parcelById.get(cellParcel[hover]!) : undefined } : null;
  const rectInfo = stroke && activeTool === 'rectangle' && stroke.rectEnd !== undefined && stroke.type !== 'neutral'
    ? { w: Math.abs(stroke.rectEnd % GRID_N - stroke.start % GRID_N) + 1, h: Math.abs(((stroke.rectEnd / GRID_N) | 0) - ((stroke.start / GRID_N) | 0)) + 1 } : null;
  const menuParcel = menu && cellParcel[menu.cell] ? parcelById.get(cellParcel[menu.cell]!) ?? null : null;

  const split = (dir: 'h' | 'v') => {
    if (!menu || !menuParcel) return;
    const x = menu.cell % GRID_N, y = (menu.cell / GRID_N) | 0;
    paint(menuParcel.cells.filter(c => (dir === 'h' ? ((c / GRID_N) | 0) === y : c % GRID_N === x)), 'neutral');
    setMenu(null);
  };

  return (
    <div className="@container flex flex-col gap-3">
      {/* Barre d'outils — rangée 1 : outils + actions */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-2xl bg-slate-100 p-1" role="toolbar" aria-label="Outils de dessin">
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setActiveTool(t.id)} title={`${t.label} — ${t.hint} (${t.key})`} aria-pressed={activeTool === t.id}
              className={cn('relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-xs font-bold transition-colors',
                activeTool === t.id ? 'text-white' : 'text-slate-600 hover:text-slate-900')}>
              {activeTool === t.id && <motion.span layoutId={`tool-${variant}`} className="absolute inset-0 rounded-xl bg-slate-900 shadow" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <t.icon className="relative h-4 w-4 shrink-0" /><span className="relative hidden truncate @2xl:inline">{t.label}</span>
              <kbd className={cn('relative hidden rounded px-1 text-[9px] font-semibold @4xl:inline', activeTool === t.id ? 'bg-white/15 text-white/80' : 'bg-white text-slate-400')}>{t.key}</kbd>
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setShowTemplates(v => !v)} title="Modèles de verger" className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <LayoutTemplate className="h-4 w-4" /><span className="hidden @3xl:inline">Modèles</span>
          </button>
          <AnimatePresence>
            {showTemplates && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => { loadTemplate(t.id); setShowTemplates(false); }}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50">
                    <TemplateThumb id={t.id} />
                    <div><div className="text-xs font-bold text-slate-800">{t.label}</div><div className="text-[11px] text-slate-500">{t.desc}</div></div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => setEditorFullscreen(!full)} title={full ? 'Réduire (Échap)' : 'Agrandir en plein écran (Maj+F)'}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-800">
          {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}<span className="hidden @3xl:inline">{full ? 'Réduire' : 'Agrandir'}</span>
        </button>
      </div>

      {/* Rangée 2 : palette + taille du pinceau */}
      <div className="flex items-stretch gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5">
          {PALETTE.map((t, i) => {
            const on = activeCellType === t && activeTool !== 'eraser';
            return (
              <button key={t} onClick={() => setActiveCellType(t)} title={`${TYPE_LABEL[t]} (touche ${i + 1})`}
                className={cn('flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1.5 py-1.5 text-center transition-all @xl:flex-row @xl:gap-2 @xl:px-2 @xl:text-left',
                  on ? 'border-slate-900 bg-white shadow-md ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-slate-300')}>
                <span className={cn('h-6 w-6 shrink-0 rounded-lg shadow-inner', t === 'forest' && 'hatch')} style={{ backgroundColor: CELL_BG[t] }} />
                <span className="min-w-0 leading-tight">
                  <span className="block text-[11px] font-bold text-slate-800">{SHORT[t]}</span>
                  <span className="hidden text-[9px] text-slate-400 @3xl:block">touche {i + 1}</span>
                </span>
              </button>
            );
          })}
        </div>
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 @xl:flex-row" title="Taille du pinceau ([ / ])">
            {([1, 2, 3] as const).map(n => (
              <button key={n} onClick={() => setBrushSize(n)} aria-label={`Pinceau ${n}×${n}`}
                className={cn('flex h-6 w-7 items-center justify-center rounded-lg @xl:h-8 @xl:w-8', brushSize === n ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}>
                <span className={cn('rounded-[3px]', brushSize === n ? 'bg-white' : 'bg-slate-500')} style={{ width: 4 + n * 3, height: 4 + n * 3 }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grille */}
      <div className="relative mx-auto w-full" style={{ maxWidth: compact ? 420 : full ? 'min(100%, calc(100vh - 260px))' : 'min(100%, calc(100vh - 250px), 900px)' }}>
        <div ref={gridRef}
          className="relative grid aspect-square w-full touch-none select-none overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-inner"
          style={{ gridTemplateColumns: `repeat(${GRID_N}, 1fr)`, cursor: activeTool === 'select' ? 'pointer' : 'crosshair' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)} onContextMenu={e => e.preventDefault()}>
          {cellLayer}
          {/* étiquettes des parcelles (placement intelligent, sans chevauchement) */}
          {labels.map(l => (
            <div key={l.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-slate-800 shadow ring-1 ring-black/5" style={{ left: `${l.x}%`, top: `${l.y}%` }}>
              {l.text}
            </div>
          ))}
          {hoverCells.map(c => (
            <div key={`h${c}`} className="pointer-events-none absolute ring-2 ring-inset ring-slate-900/80"
              style={{ left: `${(c % GRID_N) * 5}%`, top: `${((c / GRID_N) | 0) * 5}%`, width: '5%', height: '5%', backgroundColor: activeTool === 'eraser' ? 'rgba(255,255,255,.45)' : activeTool === 'brush' ? `${CELL_BG[activeCellType]}66` : undefined }} />
          ))}
          {rectInfo && (
            <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] font-bold text-white shadow">
              {rectInfo.w} × {rectInfo.h} cases · {(rectInfo.w * rectInfo.h * haPerCell).toFixed(2)} ha
            </div>
          )}
        </div>

        {/* Menu contextuel flottant */}
        <AnimatePresence>
          {menu && menuParcel && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="absolute z-40 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
              style={{ left: Math.min(menu.x, 300), top: menu.y + 12 }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{menuParcel.name}</span>
                <button onClick={() => setMenu(null)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Changer cette case</p>
              <div className="mb-2 grid grid-cols-4 gap-1">
                {PALETTE.map(t => (
                  <button key={t} title={TYPE_LABEL[t]} onClick={() => { paint([menu.cell], t); setMenu(null); }}
                    className={cn('h-7 rounded-md border-2', grid[menu.cell] === t ? 'border-slate-900' : 'border-transparent', t === 'forest' && 'hatch')} style={{ backgroundColor: CELL_BG[t] }} />
                ))}
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Changer toute la parcelle</p>
              <div className="mb-2 grid grid-cols-4 gap-1">
                {PALETTE.map(t => (
                  <button key={t} title={TYPE_LABEL[t]} onClick={() => { paint(menuParcel.cells, t); setMenu(null); }}
                    className={cn('h-7 rounded-md border-2', menuParcel.type === t ? 'border-slate-900' : 'border-transparent', t === 'forest' && 'hatch')} style={{ backgroundColor: CELL_BG[t] }} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <MenuBtn icon={Scissors} onClick={() => split('h')}>Scinder ↔</MenuBtn>
                <MenuBtn icon={Scissors} onClick={() => split('v')}>Scinder ↕</MenuBtn>
                <MenuBtn icon={Eraser} onClick={() => { paint([menu.cell], 'neutral'); setMenu(null); }}>Effacer case</MenuBtn>
                <MenuBtn icon={Trash2} danger onClick={() => { paint(menuParcel.cells, 'neutral'); setMenu(null); }}>Suppr. parcelle</MenuBtn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-[28px] items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">
        {hoverInfo ? (
          <span className="flex items-center gap-1.5 truncate">
            <span className="font-mono font-bold text-slate-700">{String.fromCharCode(64 + hoverInfo.x)}{hoverInfo.y}</span>
            <span className={cn('h-2.5 w-2.5 rounded-sm', hoverInfo.type === 'forest' && 'hatch')} style={{ backgroundColor: CELL_BG[hoverInfo.type] }} />
            {hoverInfo.parcel ? <b className="truncate text-slate-700">{hoverInfo.parcel.name} · {(hoverInfo.parcel.area * haPerCell).toFixed(2)} ha</b> : 'Zone neutre'}
          </span>
        ) : <span className="truncate"><b>Glisser</b> pour peindre · <b>clic droit</b> pour gommer</span>}
        <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">{(paintedCells * haPerCell).toFixed(2)} ha</span>
      </div>

      {/* Liste des parcelles */}
      {!compact && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Parcelles ({parcels.length})</span>
            <span className="text-[11px] text-slate-400">1 case = {economics.cellAreaM2} m²</span>
          </div>
          {parcels.length === 0 && <p className="p-4 text-center text-xs italic text-slate-400">Dessinez ou choisissez un modèle pour commencer.</p>}
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {parcels.map(p => (
              <li key={p.id} onClick={() => selectParcel(p.id === selectedParcelId ? null : p.id)}
                className={cn('flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50', p.id === selectedParcelId && 'bg-slate-100')}>
                <span className={cn('h-4 w-4 shrink-0 rounded', p.type === 'forest' && 'hatch')} style={{ backgroundColor: p.color }} />
                {p.type === 'forest' ? <Trees className="h-3.5 w-3.5 text-slate-400" /> : isCherry(p.type) ? <Cherry className="h-3.5 w-3.5 text-slate-400" /> : null}
                {editing === p.id ? (
                  <form className="flex flex-1 gap-1" onSubmit={e => { e.preventDefault(); renameParcel(p.id, draft.trim() || p.name); setEditing(null); }} onClick={e => e.stopPropagation()}>
                    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { renameParcel(p.id, draft.trim() || p.name); setEditing(null); }}
                      className="flex-1 rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                    <button type="submit" className="rounded bg-slate-900 p-1 text-white"><Check className="h-3 w-3" /></button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate font-semibold text-slate-700">{p.name}</span>
                    <span className="font-mono text-[11px] text-slate-500">{(p.area * haPerCell).toFixed(2)} ha</span>
                    <button onClick={e => { e.stopPropagation(); setEditing(p.id); setDraft(p.name); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Renommer">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon: Icon, children, onClick, danger }: { icon: React.ElementType; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold', danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100')}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

export function TemplateThumb({ id, size = 40 }: { id: TemplateId; size?: number }) {
  const g = useMemo(() => buildTemplate(id), [id]);
  return (
    <div className="grid shrink-0 overflow-hidden rounded-md border border-slate-200" style={{ width: size, height: size, gridTemplateColumns: `repeat(${GRID_N}, 1fr)` }}>
      {g.map((t, i) => <div key={i} style={{ backgroundColor: CELL_BG[t] }} />)}
    </div>
  );
}

export function MiniMap({ grid, values, max, size = 200 }: { grid: CellType[]; values?: Float32Array | number[]; max?: number; size?: number }) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-slate-200" style={{ width: size, height: size, gridTemplateColumns: `repeat(${GRID_N}, 1fr)` }}>
      {grid.map((t, i) => {
        if (!values) return <div key={i} className={t === 'forest' ? 'hatch' : ''} style={{ backgroundColor: CELL_BG[t] }} />;
        const v = Math.min(1, (values[i] ?? 0) / (max || 1));
        return <div key={i} title={`${Math.round(values[i] ?? 0).toLocaleString('fr-FR')} femelles/ha`} style={{ backgroundColor: heat(v), boxShadow: t !== 'neutral' ? `inset 0 0 0 1px ${CELL_BG[t]}55` : undefined }} />;
      })}
    </div>
  );
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
