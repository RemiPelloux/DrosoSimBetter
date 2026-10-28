'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useGridStore, useHistory } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/illustrations';
import { exportProject, importFile, importText, type ExportFormat } from '@/lib/projectIO';
import { ChevronDown, FileJson, Image as ImageIcon, Package, Link2, ClipboardPaste, UploadCloud, Loader2, Undo2, Redo2, Upload, Download, Share2, FileText, BookOpen, Check, AlertCircle, RotateCcw, FileSpreadsheet } from 'lucide-react';

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
  exportProject('json');
  toast('Projet sauvegardé (.json)');
}

export async function runImport(file: File) {
  const r = await importFile(file);
  toast(r.ok ? `${r.message} — « ${file.name} »` : r.message, r.ok ? 'ok' : 'err');
  return r;
}

const EXPORTS: { f: ExportFormat; label: string; desc: string; icon: React.ElementType }[] = [
  { f: 'json', label: 'Projet JSON', desc: 'Format complet et lisible (.json)', icon: FileJson },
  { f: 'drososim', label: 'Fichier DrosoSim', desc: 'Compact et compressé (.drososim)', icon: Package },
  { f: 'png', label: 'Image du verger', desc: 'PNG avec le projet intégré', icon: ImageIcon },
  { f: 'csv', label: 'Tableur CSV', desc: 'Grille + leviers, ouvrable dans Excel', icon: FileSpreadsheet },
  { f: 'txt', label: 'Lien de partage', desc: 'Fichier texte avec le lien (.txt)', icon: Link2 },
];

/** Menu « Exporter » : tous les formats sont rechargeables via « Importer » */
function ExportMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <HBtn outline onClick={() => setOpen(v => !v)} title="Exporter le projet (Ctrl+S = JSON)" label="Exporter"><Download className="h-4 w-4" /><span className="hidden lg:inline">Exporter</span><ChevronDown className="h-3 w-3" /></HBtn>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 top-full z-50 w-72 pt-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tous les formats sont rechargeables</p>
              {EXPORTS.map(e => (
                <button key={e.f} onClick={async () => { await exportProject(e.f); toast(`Exporté : ${e.label}`); setOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><e.icon className="h-4 w-4" /></span>
                  <span><span className="block text-xs font-bold text-slate-800">{e.label}</span><span className="block text-[11px] text-slate-500">{e.desc}</span></span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Menu « Importer » : n'importe quel fichier, ou un lien / texte collé */
function ImportMenu() {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const paste = async () => {
    setOpen(false);
    let txt = '';
    try { txt = await navigator.clipboard.readText(); } catch { /* permission refusée */ }
    if (!txt || !/sim=|DROSOSIM|grid|^[A-Za-z0-9+\-$_]{40,}$/.test(txt.trim())) txt = window.prompt('Collez un lien de partage, un projet JSON ou une grille :', txt) ?? '';
    if (!txt.trim()) return;
    const r = importText(txt);
    toast(r.message, r.ok ? 'ok' : 'err');
  };
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <input ref={fileRef} type="file" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) await runImport(f); e.target.value = ''; }} />
      <HBtn outline onClick={() => setOpen(v => !v)} title="Importer un projet (tout format exporté)" label="Importer"><Upload className="h-4 w-4" /><span className="hidden lg:inline">Importer</span><ChevronDown className="h-3 w-3" /></HBtn>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-full z-50 w-72 pt-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
              <button onClick={() => { setOpen(false); fileRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white"><UploadCloud className="h-4 w-4" /></span>
                <span><span className="block text-xs font-bold text-slate-800">Ouvrir un fichier…</span><span className="block text-[11px] text-slate-500">JSON, .drososim, PNG, CSV, TXT, grille</span></span>
              </button>
              <button onClick={paste} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><ClipboardPaste className="h-4 w-4" /></span>
                <span><span className="block text-xs font-bold text-slate-800">Coller un lien ou un texte</span><span className="block text-[11px] text-slate-500">Lien ?sim=…, JSON, grille copiée d’un tableur</span></span>
              </button>
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] text-slate-400">Astuce : glissez-déposez un fichier n’importe où dans l’application.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Zone de dépôt plein écran (montée une fois dans le layout) */
export function GlobalDropZone() {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; setOver(true); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const overH = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; setOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) await runImport(f);
    };
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overH); window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('dragover', overH); window.removeEventListener('drop', drop); };
  }, []);
  return (
    <AnimatePresence>
      {over && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-[#03241C]/70 p-8 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="flex h-full max-h-96 w-full max-w-2xl flex-col items-center justify-center rounded-[36px] border-4 border-dashed border-emerald-300/70 bg-white/10 text-center text-white">
            <UploadCloud className="h-14 w-14 text-emerald-300" />
            <p className="font-display mt-4 text-3xl font-semibold">Déposez votre fichier</p>
            <p className="mt-2 text-sm text-emerald-50/80">Projet JSON, .drososim, image PNG, CSV, lien .txt ou grille 20×20</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ Header
export function AppHeader({ title, subtitle, step, right, onCsv }: { title: string; subtitle?: string; step?: 1 | 2; right?: React.ReactNode; onCsv?: () => void }) {
  const { canUndo, canRedo, undo, redo } = useHistory();

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

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1920px] items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Accueil DrosoSim Next">
          <Logo size={36} />
          <span className="hidden text-base font-extrabold tracking-tight text-slate-900 xl:block">DrosoSim<span className="text-emerald-700">Next</span></span>
        </Link>
        <div className="hidden h-8 w-px bg-slate-200 sm:block" />
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
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
            <HBtn onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)" label="Annuler"><Undo2 className="h-4 w-4" /><span className="hidden 2xl:inline">Annuler</span></HBtn>
            <HBtn onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)" label="Rétablir"><Redo2 className="h-4 w-4" /><span className="hidden 2xl:inline">Rétablir</span></HBtn>
          </div>
          <Link href="/docs/presentation" title="Documentation" aria-label="Documentation" className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:flex"><BookOpen className="h-4 w-4" /><span className="hidden 2xl:inline">Docs</span></Link>
          <ImportMenu />
          <ExportMenu />
          {onCsv && <HBtn outline hideBelowSm onClick={onCsv} title="Exporter les séries temporelles en CSV (projet inclus, rechargeable)" label="Séries CSV"><FileSpreadsheet className="h-4 w-4" /><span className="hidden lg:inline">Séries CSV</span></HBtn>}
          <HBtn outline onClick={share} title="Copier un lien de partage" label="Partager"><Share2 className="h-4 w-4" /><span className="hidden lg:inline">Partager</span></HBtn>
          <HBtn outline hideBelowSm onClick={() => { if (confirm('Réinitialiser tout le projet ?')) { useGridStore.getState().resetProject(); toast('Projet réinitialisé'); } }} title="Réinitialiser le projet" label="Réinitialiser"><RotateCcw className="h-4 w-4" /><span className="hidden 2xl:inline">Réinitialiser</span></HBtn>
          {right ?? (
            <Link href="/results?print=1" aria-label="Export PDF" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Export PDF</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function HBtn({ children, onClick, disabled, title, label, outline, hideBelowSm }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; label?: string; outline?: boolean; hideBelowSm?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={label ?? title}
      className={cn('items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        hideBelowSm ? 'hidden sm:flex' : 'flex',
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

export function LiveBadge({ running, ms, source }: { running: boolean; ms?: number; source?: { label: string; error?: string } }) {
  const remote = source && !source.label.startsWith('Moteur local');
  const fallback = !!source?.error;
  const tone = running ? 'bg-amber-50 text-amber-700' : fallback ? 'bg-orange-100 text-orange-800' : remote ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-700';
  const dot = fallback ? 'bg-orange-500' : remote ? 'bg-sky-500' : 'bg-emerald-500';
  const label = fallback ? 'Secours local' : remote ? source!.label.split(' · ')[0] : 'Temps réel';
  return (
    <span title={source?.error ?? source?.label} className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold', tone)}>
      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', dot)} />}
      {running ? 'Calcul…' : `${label}${ms !== undefined ? ` · ${ms.toFixed(0)} ms` : ''}`}
    </span>
  );
}

