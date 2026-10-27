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

  const cellParcel = useMemo(() => {
    const m = new Array<string | null>(NC).fill(null);
    parcels.forEach(p => p.cells.forEach(c => (m[c] = p.id)));
    return m;
  }, [parcels]);

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
  const hoverInfo = hover !== null ? { x: hover % GRID_N + 1, y: ((hover / GRID_N) | 0) + 1, type: grid[hover], parcel: parcels.find(p => p.id === cellParcel[hover]) } : null;
  const rectInfo = stroke && activeTool === 'rectangle' && stroke.rectEnd !== undefined && stroke.type !== 'neutral'
    ? { w: Math.abs(stroke.rectEnd % GRID_N - stroke.start % GRID_N) + 1, h: Math.abs(((stroke.rectEnd / GRID_N) | 0) - ((stroke.start / GRID_N) | 0)) + 1 } : null;
  const menuParcel = menu ? parcels.find(p => p.id === cellParcel[menu.cell]) : null;

  const split = (dir: 'h' | 'v') => {
    if (!menu || !menuParcel) return;
    const x = menu.cell % GRID_N, y = (menu.cell / GRID_N) | 0;
    paint(menuParcel.cells.filter(c => (dir === 'h' ? ((c / GRID_N) | 0) === y : c % GRID_N === x)), 'neutral');
    setMenu(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)} title={`${t.hint} (${t.key})`}
            className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
              activeTool === t.id ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100')}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5" title="Taille du pinceau ([ / ])">
            {([1, 2, 3] as const).map(n => (
              <button key={n} onClick={() => setBrushSize(n)} className={cn('flex h-7 w-7 items-center justify-center rounded-md', brushSize === n ? 'bg-white shadow' : 'hover:bg-white/60')}>
                <span className="rounded-full bg-slate-700" style={{ width: 3 + n * 3, height: 3 + n * 3 }} />
              </button>
            ))}
          </div>
        )}
        <div className="relative ml-auto flex items-center gap-1.5">
          <button onClick={() => setEditorFullscreen(!full)} title={full ? 'Réduire (Échap)' : 'Agrandir l’éditeur en plein écran (Maj+F)'}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />} {full ? 'Réduire' : 'Agrandir'}
          </button>
          <button onClick={() => setShowTemplates(v => !v)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <LayoutTemplate className="h-3.5 w-3.5" /> Modèles
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
      </div>

      {/* Palette */}
      <div className="grid grid-cols-4 gap-1.5">
        {PALETTE.map((t, i) => (
          <button key={t} onClick={() => setActiveCellType(t)}
            className={cn('flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left transition-all',
              activeCellType === t && activeTool !== 'eraser' ? 'border-slate-900 bg-white shadow-md' : 'border-transparent bg-slate-50 hover:border-slate-200')}>
            <span className={cn('h-5 w-5 shrink-0 rounded-md', t === 'forest' && 'hatch')} style={{ backgroundColor: CELL_BG[t] }} />
            <span className="text-[11px] font-semibold leading-tight text-slate-700">{TYPE_LABEL[t].replace('Cerise ', '')}<span className="hidden text-[9px] font-normal text-slate-400 md:block">touche {i + 1}</span></span>
          </button>
        ))}
      </div>

      {/* Grille */}
      <div className="relative mx-auto w-full" style={{ maxWidth: compact ? 420 : full ? 'min(100%, calc(100vh - 260px))' : 'min(100%, calc(100vh - 250px), 900px)' }}>
        <div ref={gridRef}
          className="relative grid aspect-square w-full touch-none select-none overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-inner"
          style={{ gridTemplateColumns: `repeat(${GRID_N}, 1fr)`, cursor: activeTool === 'select' ? 'pointer' : 'crosshair' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)} onContextMenu={e => e.preventDefault()}>
          {cellLayer}
          {/* étiquettes des parcelles */}
          {parcels.map(p => {
            const xs = p.cells.map(c => c % GRID_N), ys = p.cells.map(c => (c / GRID_N) | 0);
            const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2 / GRID_N * 100, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2 / GRID_N * 100;
            if (p.cells.length < 6) return null;
            return (
              <div key={p.id} className="pointer-events-none absolute max-w-[45%] -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-800 shadow" style={{ left: `${cx}%`, top: `${cy}%` }}>
                {p.name}
              </div>
            );
          })}
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
        ) : <span className="truncate">Clic-glisser pour peindre · <b>clic droit</b> = gomme · clic sur une case existante = éditer · <b>Ctrl+Z</b></span>}
        <span className="shrink-0 font-mono">{grid.filter(c => c !== 'neutral').length} cases · {(grid.filter(c => c !== 'neutral').length * haPerCell).toFixed(2)} ha</span>
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
