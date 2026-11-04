import { Component, signal } from '@angular/core';
import { ChevronDown, FileJson, Image as ImageIcon, Package, Link2, Download, FileSpreadsheet, type IconNode } from 'lucide';
import { exportProject, type ExportFormat } from '@/lib/projectIO';
import { toast } from '@/lib/toast';
import { Lucide } from '../ui/lucide';
import { Motion } from '../ui/motion';
import { HBtn } from './h-btn.component';

const EXPORTS: { f: ExportFormat; label: string; desc: string; icon: IconNode }[] = [
  { f: 'json', label: 'Projet JSON', desc: 'Format complet et lisible (.json)', icon: FileJson },
  { f: 'drososim', label: 'Fichier DrosoSim', desc: 'Compact et compressé (.drososim)', icon: Package },
  { f: 'png', label: 'Image du verger', desc: 'PNG avec le projet intégré', icon: ImageIcon },
  { f: 'csv', label: 'Tableur CSV', desc: 'Grille + leviers, ouvrable dans Excel', icon: FileSpreadsheet },
  { f: 'txt', label: 'Lien de partage', desc: 'Fichier texte avec le lien (.txt)', icon: Link2 },
];

/** Menu « Exporter » : tous les formats sont rechargeables via « Importer » */
@Component({
  selector: 'ds-export-menu',
  imports: [HBtn, Lucide, Motion],
  host: { style: 'display: contents' },
  templateUrl: './export-menu.component.html',
})
export class ExportMenu {
  protected open = signal(false);
  protected exports = EXPORTS;
  protected I = { Download, ChevronDown };
  protected async run(e: (typeof EXPORTS)[number]) { await exportProject(e.f); toast(`Exporté : ${e.label}`); this.open.set(false); }
}
