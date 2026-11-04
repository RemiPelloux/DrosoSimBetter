import { Component, DestroyRef, inject, signal } from '@angular/core';
import { UploadCloud } from 'lucide';
import { Lucide } from '../ui/lucide';
import { Motion } from '../ui/motion';
import { runImport } from './app-header.utils';

/** Zone de dépôt plein écran (montée une fois dans la racine) */
@Component({
  selector: 'ds-global-drop-zone',
  imports: [Lucide, Motion],
  host: { style: 'display: contents' },
  templateUrl: './global-drop-zone.component.html',
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
