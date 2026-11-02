import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronDown, FileJson, Image as ImageIcon, Package, Link2, ClipboardPaste, UploadCloud, Loader2, Undo2, Redo2, Upload, Download, Share2, FileText, BookOpen, Check, AlertCircle, RotateCcw, FileSpreadsheet, type IconNode } from 'lucide';
import { gridStore, history } from '@/lib/store';
import { cn } from '@/lib/utils';
import { exportProject, importFile, importText, type ExportFormat } from '@/lib/projectIO';
import { toast, toasts } from '@/lib/toast';
import { Lucide } from './ui/lucide';
import { Motion } from './ui/motion';
import { Logo } from './illustrations';

export { toast, download } from '@/lib/toast';

// ------------------------------------------------------------------ Toasts
@Component({
  selector: 'ds-toaster',
  imports: [Lucide, Motion],
  host: { style: 'display: contents' },
  template: `
    <div class="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      @for (t of items(); track t.id) {
        <div motion [initial]="{ opacity: 0, y: 20, scale: 0.95 }" [animate]="{ opacity: 1, y: 0, scale: 1 }" [exit]="{ opacity: 0, y: 10 }"
          [class]="cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl', t.kind === 'ok' ? 'bg-slate-900' : 'bg-red-600')">
          @if (t.kind === 'ok') { <svg [lucide]="I.Check" class="h-4 w-4 text-emerald-400"></svg> } @else { <svg [lucide]="I.AlertCircle" class="h-4 w-4"></svg> } {{ t.msg }}
        </div>
      }
    </div>
  `,
})
export class Toaster {
  protected items = toasts;
  protected I = { Check, AlertCircle };
  protected cn = cn;
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

const EXPORTS: { f: ExportFormat; label: string; desc: string; icon: IconNode }[] = [
  { f: 'json', label: 'Projet JSON', desc: 'Format complet et lisible (.json)', icon: FileJson },
  { f: 'drososim', label: 'Fichier DrosoSim', desc: 'Compact et compressé (.drososim)', icon: Package },
  { f: 'png', label: 'Image du verger', desc: 'PNG avec le projet intégré', icon: ImageIcon },
  { f: 'csv', label: 'Tableur CSV', desc: 'Grille + leviers, ouvrable dans Excel', icon: FileSpreadsheet },
  { f: 'txt', label: 'Lien de partage', desc: 'Fichier texte avec le lien (.txt)', icon: Link2 },
];

// ------------------------------------------------------------------ Bouton d'en-tête
@Component({
  selector: 'ds-hbtn',
  host: { '[attr.title]': 'null', style: 'display: contents' },
  template: `
    <button (click)="press.emit()" [disabled]="disabled()" [title]="title()" [attr.aria-label]="label() ?? title()"
      [class]="cn('items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        hideBelowSm() ? 'hidden sm:flex' : 'flex',
        outline() ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'text-slate-700 hover:bg-white')">
      <ng-content />
    </button>
  `,
})
export class HBtn {
  readonly disabled = input(false);
  readonly title = input.required<string>();
  readonly label = input<string>();
  readonly outline = input(false);
  readonly hideBelowSm = input(false);
  readonly press = output<void>();
  protected cn = cn;
}

/** Menu « Exporter » : tous les formats sont rechargeables via « Importer » */
@Component({
  selector: 'ds-export-menu',
  imports: [HBtn, Lucide, Motion],
  host: { style: 'display: contents' },
  template: `
    <div class="relative" (mouseleave)="open.set(false)">
      <ds-hbtn [outline]="true" (press)="open.set(!open())" title="Exporter le projet (Ctrl+S = JSON)" label="Exporter"><svg [lucide]="I.Download" class="h-4 w-4"></svg><span class="hidden lg:inline">Exporter</span><svg [lucide]="I.ChevronDown" class="h-3 w-3"></svg></ds-hbtn>
      @if (open()) {
        <div motion [initial]="{ opacity: 0, y: -6 }" [animate]="{ opacity: 1, y: 0 }" [exit]="{ opacity: 0, y: -6 }"
          class="absolute right-0 top-full z-50 w-72 pt-1">
          <div class="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
            <p class="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tous les formats sont rechargeables</p>
            @for (e of exports; track e.f) {
              <button (click)="run(e)" class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
                <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><svg [lucide]="e.icon" class="h-4 w-4"></svg></span>
                <span><span class="block text-xs font-bold text-slate-800">{{ e.label }}</span><span class="block text-[11px] text-slate-500">{{ e.desc }}</span></span>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ExportMenu {
  protected open = signal(false);
  protected exports = EXPORTS;
  protected I = { Download, ChevronDown };
  protected async run(e: (typeof EXPORTS)[number]) { await exportProject(e.f); toast(`Exporté : ${e.label}`); this.open.set(false); }
}

/** Menu « Importer » : n'importe quel fichier, ou un lien / texte collé */
@Component({
  selector: 'ds-import-menu',
  imports: [HBtn, Lucide, Motion],
  host: { style: 'display: contents' },
  template: `
    <div class="relative" (mouseleave)="open.set(false)">
      <input #file type="file" class="hidden" (change)="onFile($event)" />
      <ds-hbtn [outline]="true" (press)="open.set(!open())" title="Importer un projet (tout format exporté)" label="Importer"><svg [lucide]="I.Upload" class="h-4 w-4"></svg><span class="hidden lg:inline">Importer</span><svg [lucide]="I.ChevronDown" class="h-3 w-3"></svg></ds-hbtn>
      @if (open()) {
        <div motion [initial]="{ opacity: 0, y: -6 }" [animate]="{ opacity: 1, y: 0 }" [exit]="{ opacity: 0, y: -6 }" class="absolute right-0 top-full z-50 w-72 pt-1">
          <div class="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
            <button (click)="open.set(false); file.click()" class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white"><svg [lucide]="I.UploadCloud" class="h-4 w-4"></svg></span>
              <span><span class="block text-xs font-bold text-slate-800">Ouvrir un fichier…</span><span class="block text-[11px] text-slate-500">JSON, .drososim, PNG, CSV, TXT, grille</span></span>
            </button>
            <button (click)="paste()" class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><svg [lucide]="I.ClipboardPaste" class="h-4 w-4"></svg></span>
              <span><span class="block text-xs font-bold text-slate-800">Coller un lien ou un texte</span><span class="block text-[11px] text-slate-500">Lien ?sim=…, JSON, grille copiée d’un tableur</span></span>
            </button>
            <p class="px-2.5 pb-1.5 pt-1 text-[11px] text-slate-400">Astuce : glissez-déposez un fichier n’importe où dans l’application.</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class ImportMenu {
  protected open = signal(false);
  protected I = { Upload, ChevronDown, UploadCloud, ClipboardPaste };
  protected async onFile(e: Event) {
    const t = e.target as HTMLInputElement;
    const f = t.files?.[0];
    if (f) await runImport(f);
    t.value = '';
  }
  protected async paste() {
    this.open.set(false);
    let txt = '';
    try { txt = await navigator.clipboard.readText(); } catch { /* permission refusée */ }
    if (!txt || !/sim=|DROSOSIM|grid|^[A-Za-z0-9+\-$_]{40,}$/.test(txt.trim())) txt = window.prompt('Collez un lien de partage, un projet JSON ou une grille :', txt) ?? '';
    if (!txt.trim()) return;
    const r = importText(txt);
    toast(r.message, r.ok ? 'ok' : 'err');
  }
}

/** Zone de dépôt plein écran (montée une fois dans la racine) */
@Component({
  selector: 'ds-global-drop-zone',
  imports: [Lucide, Motion],
  host: { style: 'display: contents' },
  template: `
    @if (over()) {
      <div motion [initial]="{ opacity: 0 }" [animate]="{ opacity: 1 }" [exit]="{ opacity: 0 }" class="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-[#03241C]/70 p-8 backdrop-blur-sm">
        <div motion [initial]="{ scale: 0.92 }" [animate]="{ scale: 1 }" class="flex h-full max-h-96 w-full max-w-2xl flex-col items-center justify-center rounded-[36px] border-4 border-dashed border-emerald-300/70 bg-white/10 text-center text-white">
          <svg [lucide]="I.UploadCloud" class="h-14 w-14 text-emerald-300"></svg>
          <p class="font-display mt-4 text-3xl font-semibold">Déposez votre fichier</p>
          <p class="mt-2 text-sm text-emerald-50/80">Projet JSON, .drososim, image PNG, CSV, lien .txt ou grille 20×20</p>
        </div>
      </div>
    }
  `,
})
export class GlobalDropZone {
  protected over = signal(false);
  protected I = { UploadCloud };
  constructor() {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; this.over.set(true); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) this.over.set(false); };
    const overH = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; this.over.set(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) await runImport(f);
    };
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overH); window.addEventListener('drop', drop);
    inject(DestroyRef).onDestroy(() => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('dragover', overH); window.removeEventListener('drop', drop); });
  }
}

// ------------------------------------------------------------------ Header
/**
 * En-tête des pages de l'application.
 * Le contenu projeté avec l'attribut `right` remplace le bouton « Export PDF » :
 *   <ds-app-header title="…"><a right …>…</a></ds-app-header>
 */
@Component({
  selector: 'ds-app-header',
  imports: [RouterLink, HBtn, ImportMenu, ExportMenu, Lucide, Logo],
  host: { '[attr.title]': 'null', style: 'display: contents', '(window:keydown)': 'onKey($event)' },
  template: `
    <header class="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-[1920px] items-center gap-3 px-4">
        <a routerLink="/" class="flex shrink-0 items-center gap-2" aria-label="Accueil DrosoSim Next">
          <ds-logo [size]="36" />
          <span class="hidden text-base font-extrabold tracking-tight text-slate-900 xl:block">DrosoSim<span class="text-emerald-700">Next</span></span>
        </a>
        <div class="hidden h-8 w-px bg-slate-200 sm:block"></div>
        <div class="hidden min-w-0 sm:block">
          <h1 class="truncate text-sm font-bold text-slate-900">{{ title() }}</h1>
          @if (subtitle()) { <p class="truncate text-[11px] text-slate-500">{{ subtitle() }}</p> }
        </div>
        @if (step()) {
          <div class="ml-2 hidden items-center gap-1 rounded-full bg-slate-100 p-1 md:flex">
            <a routerLink="/simulator" [class]="cn('rounded-full px-3 py-1 text-[11px] font-bold', step() === 1 ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800')">1 · Verger & leviers</a>
            <a routerLink="/results" [class]="cn('rounded-full px-3 py-1 text-[11px] font-bold', step() === 2 ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800')">2 · Résultats</a>
          </div>
        }
        <div class="ml-auto flex min-w-0 items-center gap-1.5">
          <div class="flex items-center rounded-lg bg-slate-100 p-0.5">
            <ds-hbtn (press)="undo()" [disabled]="!canUndo()" title="Annuler (Ctrl+Z)" label="Annuler"><svg [lucide]="I.Undo2" class="h-4 w-4"></svg><span class="hidden 2xl:inline">Annuler</span></ds-hbtn>
            <ds-hbtn (press)="redo()" [disabled]="!canRedo()" title="Rétablir (Ctrl+Y)" label="Rétablir"><svg [lucide]="I.Redo2" class="h-4 w-4"></svg><span class="hidden 2xl:inline">Rétablir</span></ds-hbtn>
          </div>
          <a routerLink="/docs/presentation" title="Documentation" aria-label="Documentation" class="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:flex"><svg [lucide]="I.BookOpen" class="h-4 w-4"></svg><span class="hidden 2xl:inline">Docs</span></a>
          <ds-import-menu />
          <ds-export-menu />
          @if (csv()) { <ds-hbtn [outline]="true" [hideBelowSm]="true" (press)="exportCsv.emit()" title="Exporter les séries temporelles en CSV (projet inclus, rechargeable)" label="Séries CSV"><svg [lucide]="I.FileSpreadsheet" class="h-4 w-4"></svg><span class="hidden lg:inline">Séries CSV</span></ds-hbtn> }
          <ds-hbtn [outline]="true" (press)="share()" title="Copier un lien de partage" label="Partager"><svg [lucide]="I.Share2" class="h-4 w-4"></svg><span class="hidden lg:inline">Partager</span></ds-hbtn>
          <ds-hbtn [outline]="true" [hideBelowSm]="true" (press)="reset()" title="Réinitialiser le projet" label="Réinitialiser"><svg [lucide]="I.RotateCcw" class="h-4 w-4"></svg><span class="hidden 2xl:inline">Réinitialiser</span></ds-hbtn>
          <span #right class="contents"><ng-content select="[right]" /></span>
          @if (!hasRight()) {
            <a routerLink="/results" [queryParams]="{ print: 1 }" aria-label="Export PDF" class="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
              <svg [lucide]="I.FileText" class="h-4 w-4"></svg> <span class="hidden sm:inline">Export PDF</span>
            </a>
          }
        </div>
      </div>
    </header>
  `,
})
export class AppHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly step = input<1 | 2>();
  /** Affiche le bouton « Séries CSV » (événement exportCsv). */
  readonly csv = input(false);
  readonly exportCsv = output<void>();

  protected I = { Undo2, Redo2, BookOpen, FileSpreadsheet, Share2, RotateCcw, FileText };
  protected cn = cn;
  protected canUndo = history.canUndo;
  protected canRedo = history.canRedo;
  protected undo = history.undo;
  protected redo = history.redo;
  private right = viewChild.required<ElementRef<HTMLElement>>('right');
  protected hasRight = signal(false);

  constructor() {
    afterNextRender(() => this.hasRight.set(this.right().nativeElement.childElementCount > 0));
  }

  protected onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest('input,textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
    else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
    else if (e.key.toLowerCase() === 's') { e.preventDefault(); saveJson(); }
  }

  protected async share() {
    const s = gridStore.getState().toShareString();
    const url = `${window.location.origin}${window.location.pathname}?sim=${s}`;
    try { await navigator.clipboard.writeText(url); toast(`Lien copié (${url.length} caractères)`); }
    catch { window.prompt('Copiez ce lien :', url); }
  }

  protected reset() {
    if (confirm('Réinitialiser tout le projet ?')) { gridStore.getState().resetProject(); toast('Projet réinitialisé'); }
  }
}

/** Hydrate depuis ?sim=... (lien de partage). À appeler dans le constructeur d'une page. */
export function injectShareHydration() {
  afterNextRender(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('sim');
    if (!s) return;
    const ok = gridStore.getState().fromShareString(s);
    toast(ok ? 'Scénario partagé chargé' : 'Lien de partage invalide', ok ? 'ok' : 'err');
    p.delete('sim');
    window.history.replaceState(window.history.state, '', window.location.pathname + (p.toString() ? `?${p}` : ''));
  });
}

@Component({
  selector: 'ds-live-badge',
  imports: [Lucide],
  host: { style: 'display: contents' },
  template: `
    <span [title]="source()?.error ?? source()?.label ?? ''" [class]="cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold', tone())">
      @if (running()) { <svg [lucide]="I.Loader2" class="h-3 w-3 animate-spin"></svg> } @else { <span [class]="cn('relative h-1.5 w-1.5 rounded-full', dot(), !fallback() && 'live-ring text-emerald-500', remote() && 'text-sky-500')"></span> }
      {{ running() ? 'Calcul…' : label() + (ms() !== undefined ? ' · ' + ms()!.toFixed(0) + ' ms' : '') }}
    </span>
  `,
})
export class LiveBadge {
  readonly running = input.required<boolean>();
  readonly ms = input<number>();
  readonly source = input<{ label: string; error?: string }>();
  protected I = { Loader2 };
  protected cn = cn;
  protected remote = computed(() => { const s = this.source(); return !!s && !s.label.startsWith('Moteur local'); });
  protected fallback = computed(() => !!this.source()?.error);
  protected tone = computed(() => this.running() ? 'bg-amber-50 text-amber-700' : this.fallback() ? 'bg-orange-100 text-orange-800' : this.remote() ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-700');
  protected dot = computed(() => this.fallback() ? 'bg-orange-500' : this.remote() ? 'bg-sky-500' : 'bg-emerald-500');
  protected label = computed(() => this.fallback() ? 'Secours local' : this.remote() ? this.source()!.label.split(' · ')[0] : 'Temps réel');
}
