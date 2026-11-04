import { Component, signal } from '@angular/core';
import { ChevronDown, ClipboardPaste, UploadCloud, Upload } from 'lucide';
import { importText } from '@/lib/projectIO';
import { toast } from '@/lib/toast';
import { Lucide } from '../ui/lucide';
import { Motion } from '../ui/motion';
import { HBtn } from './h-btn.component';
import { runImport } from './app-header.utils';

/** Menu « Importer » : n'importe quel fichier, ou un lien / texte collé */
@Component({
  selector: 'ds-import-menu',
  imports: [HBtn, Lucide, Motion],
  host: { style: 'display: contents' },
  templateUrl: './import-menu.component.html',
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
