import { signal } from '@angular/core';

export type Toast = { id: number; msg: string; kind: 'ok' | 'err' };

/** File des notifications affichées par <ds-toaster> (monté une fois dans la racine). */
export const toasts = signal<Toast[]>([]);

export function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  const id = Date.now() + Math.random();
  toasts.update(x => [...x, { msg, kind, id }]);
  setTimeout(() => toasts.update(x => x.filter(i => i.id !== id)), 3200);
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
