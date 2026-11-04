import { Component } from '@angular/core';
import { Motion } from '../ui/motion';

const LEVER_LABELS = ['Ressource', 'Adultes A', 'Ponte', 'Larves L', 'Fertilité'].map((t, i) => ({ t, x: 100 + i * 140 }));
const LEVER_ITEMS = [
  { l: 'Filet', c: '#2563EB', on: 'accès aux fruits & immigration', x: 18 },
  { l: 'Traitement', c: '#D97706', on: 'mortalité des adultes', x: 158 },
  { l: 'Prophylaxie', c: '#0D9488', on: 'fruits résiduels post-récolte', x: 298 },
  { l: 'Parasitoïdes', c: '#7C3AED', on: 'survie des larves', x: 438 },
  { l: 'TIS', c: '#DB2777', on: 'fertilité des pontes', x: 578 },
].map((it, i) => {
  const target = [100 + 140 * 2, 100 + 140, 100, 100 + 140 * 3, 100 + 140 * 4][i];
  return { ...it, d: `M${it.x + 62} 66 C ${it.x + 62} 84, ${target} 78, ${target} 98` };
});

/** Effet de chaque levier sur le cycle */
@Component({
  selector: 'ds-lever-map-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './lever-map-diagram.component.html',
})
export class LeverMapDiagram {
  protected labels = LEVER_LABELS;
  protected items = LEVER_ITEMS;
}
