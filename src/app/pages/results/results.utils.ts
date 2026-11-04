import { type Type } from '@angular/core';
import { type IconNode } from 'lucide';
import { type StrategyResult } from '@/lib/engine';

/** Icône Lucide (IconNode) ou icône maison (composant). */
export type AnyIconT = IconNode | Type<unknown>;
export type ColorFn = (id: string) => string;
export const EASE = [0.16, 1, 0.3, 1];

/** Pic maximal du témoin (échelle commune des cartes) — boucle simple, sans copie ni spread de 400 valeurs */
export function peakMax(r: StrategyResult) {
  let m = 1;
  for (let i = 0; i < r.peakByCell.length; i++) if (r.peakByCell[i] > m) m = r.peakByCell[i];
  return m;
}

export interface Chip { icon: AnyIconT; label: string }
