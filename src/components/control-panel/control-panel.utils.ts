import { type Type } from '@angular/core';
import { isCherry, type CellType } from '@/lib/engine';
import { IconNet, IconHygiene, IconSpray, IconParasitoid, IconSterileMale } from '@/components/icons';

export type LeverKey = 'prophylaxis' | 'netting' | 'treatment' | 'parasitoids' | 'tis';

export const LEVERS: { key: LeverKey; label: string; short: string; icon: Type<unknown>; color: string; targets: (t: CellType) => boolean; cost: string; note: string }[] = [
  { key: 'prophylaxis', label: 'Prophylaxie / Hygiène', short: 'Prophylaxie', icon: IconHygiene, color: '#0D9488', targets: isCherry, cost: 'Matériel faible · MO très élevée', note: 'Réduit les fruits résiduels et la population qui hiverne' },
  { key: 'netting', label: 'Filet insect-proof', short: 'Filet', icon: IconNet, color: '#2563EB', targets: isCherry, cost: 'Investissement €€€ · IFT 0', note: 'Bloque l’accès aux fruits et filtre les mouvements' },
  { key: 'treatment', label: 'Protection phyto / Biocontrôle', short: 'Traitement', icon: IconSpray, color: '#D97706', targets: isCherry, cost: 'Coût €€ · IFT élevé (chimie) · DAR', note: 'Mortalité des adultes pendant la rémanence · coût sur passages réels' },
  { key: 'parasitoids', label: 'Lâchers de parasitoïdes', short: 'Parasitoïdes', icon: IconParasitoid, color: '#7C3AED', targets: t => t === 'forest' || isCherry(t), cost: 'Effet de fond · montée en puissance A2-A3', note: 'Ganaspis / Trichopria : larves parasitées, effet cumulatif' },
  { key: 'tis', label: 'TIS (mâles stériles)', short: 'TIS', icon: IconSterileMale, color: '#DB2777', targets: isCherry, cost: 'Technologie de pointe · zéro résidu', note: 'Réduit les pontes fertiles de fin mars à mi-septembre' },
];
export type Lever = (typeof LEVERS)[number];
