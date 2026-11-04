import { Component, ElementRef, afterNextRender, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Undo2, Redo2, Share2, FileText, BookOpen, RotateCcw, FileSpreadsheet } from 'lucide';
import { gridStore, history } from '@/lib/store';
import { cn } from '@/lib/utils';
import { exportProject } from '@/lib/projectIO';
import { toast } from '@/lib/toast';
import { Lucide } from '../ui/lucide';
import { Logo } from '../illustrations';
import { HBtn } from './h-btn.component';
import { ImportMenu } from './import-menu.component';
import { ExportMenu } from './export-menu.component';

function saveJson() {
  exportProject('json');
  toast('Projet sauvegardé (.json)');
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
  templateUrl: './app-header.component.html',
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
