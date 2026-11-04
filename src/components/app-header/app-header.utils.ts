import { afterNextRender } from '@angular/core';
import { gridStore } from '@/lib/store';
import { importFile } from '@/lib/projectIO';
import { toast } from '@/lib/toast';

export async function runImport(file: File) {
  const r = await importFile(file);
  toast(r.ok ? `${r.message} — « ${file.name} »` : r.message, r.ok ? 'ok' : 'err');
  return r;
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
