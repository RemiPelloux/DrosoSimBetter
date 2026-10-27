'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useGridStore, useHistory } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Loader2, Undo2, Redo2, Upload, Download, Share2, FileText, Leaf, Check, AlertCircle, RotateCcw, FileSpreadsheet } from 'lucide-react';

// ------------------------------------------------------------------ Toasts
type Toast = { id: number; msg: string; kind: 'ok' | 'err' };
let push: (t: Omit<Toast, 'id'>) => void = () => {};
export const toast = (msg: string, kind: 'ok' | 'err' = 'ok') => push({ msg, kind });

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = t => { const id = Date.now() + Math.random(); setItems(x => [...x, { ...t, id }]); setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 3200); };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {items.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
            className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl', t.kind === 'ok' ? 'bg-slate-900' : 'bg-red-600')}>
            {t.kind === 'ok' ? <Check className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4" />} {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveJson() {
  download(`drososim-${new Date().toISOString().slice(0, 10)}.json`, useGridStore.getState().saveProject(), 'application/json');
  toast('Projet sauvegardé (.json)');
}

// ------------------------------------------------------------------ Header
export function AppHeader({ title, subtitle, step, right, onCsv }: { title: string; subtitle?: string; step?: 1 | 2; right?: React.ReactNode; onCsv?: () => void }) {
  const { canUndo, canRedo, undo, redo } = useHistory();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); saveJson(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const share = async () => {
    const s = useGridStore.getState().toShareString();
    const url = `${window.location.origin}${window.location.pathname}?sim=${s}`;
    try { await navigator.clipboard.writeText(url); toast(`Lien copié (${url.length} caractères)`); }
    catch { window.prompt('Copiez ce lien :', url); }
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = useGridStore.getState().loadProject(await f.text());
    toast(ok ? `Projet « ${f.name} » importé` : 'Fichier invalide', ok ? 'ok' : 'err');
    e.target.value = '';
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1920px] items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"><Leaf className="h-5 w-5" /></span>
          <span className="hidden text-base font-extrabold tracking-tight text-slate-900 xl:block">DrosoSim<span className="text-emerald-700">Next</span></span>
        </Link>
        <div className="h-8 w-px bg-slate-200" />
        <div className="hidden min-w-0 sm:block">
          <h1 className="truncate text-sm font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {step && (
          <div className="ml-2 hidden items-center gap-1 rounded-full bg-slate-100 p-1 md:flex">
            <Link href="/simulator" className={cn('rounded-full px-3 py-1 text-[11px] font-bold', step === 1 ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800')}>1 · Verger & leviers</Link>
            <Link href="/results" className={cn('rounded-full px-3 py-1 text-[11px] font-bold', step === 2 ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800')}>2 · Résultats</Link>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
            <HBtn onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)"><Undo2 className="h-4 w-4" /><span className="hidden 2xl:inline">Annuler</span></HBtn>
            <HBtn onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)"><Redo2 className="h-4 w-4" /><span className="hidden 2xl:inline">Rétablir</span></HBtn>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
          <HBtn outline onClick={() => fileRef.current?.click()} title="Importer un projet JSON"><Upload className="h-4 w-4" /><span className="hidden lg:inline">Importer</span></HBtn>
          <HBtn outline onClick={saveJson} title="Sauvegarder en JSON (Ctrl+S)"><Download className="h-4 w-4" /><span className="hidden lg:inline">Sauvegarder</span></HBtn>
          {onCsv && <HBtn outline onClick={onCsv} title="Exporter les séries temporelles en CSV"><FileSpreadsheet className="h-4 w-4" /><span className="hidden lg:inline">CSV</span></HBtn>}
          <HBtn outline onClick={share} title="Copier un lien de partage"><Share2 className="h-4 w-4" /><span className="hidden lg:inline">Partager</span></HBtn>
          <HBtn outline onClick={() => { if (confirm('Réinitialiser tout le projet ?')) { useGridStore.getState().resetProject(); toast('Projet réinitialisé'); } }} title="Réinitialiser le projet"><RotateCcw className="h-4 w-4" /><span className="hidden 2xl:inline">Réinitialiser</span></HBtn>
          {right ?? (
            <Link href="/results?print=1" className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Export PDF</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function HBtn({ children, onClick, disabled, title, outline }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; outline?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn('flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        outline ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'text-slate-700 hover:bg-white')}>
      {children}
    </button>
  );
}

/** Hydrate depuis ?sim=... (lien de partage) */
export function useShareHydration() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('sim');
    if (!s) return;
    const ok = useGridStore.getState().fromShareString(s);
    toast(ok ? 'Scénario partagé chargé' : 'Lien de partage invalide', ok ? 'ok' : 'err');
    p.delete('sim');
    window.history.replaceState({}, '', window.location.pathname + (p.toString() ? `?${p}` : ''));
  }, []);
}

export function LiveBadge({ running, ms }: { running: boolean; ms?: number }) {
  return (
    <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold', running ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
      {running ? 'Calcul…' : `Temps réel${ms !== undefined ? ` · ${ms.toFixed(0)} ms` : ''}`}
    </span>
  );
}

