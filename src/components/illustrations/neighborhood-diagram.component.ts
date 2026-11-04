import { Component } from '@angular/core';
import { Motion } from '../ui/motion';
import { uid } from './illustrations.utils';

const NB_W = [[0.25, 3, 3], [0.6, null, 3], [0.15, 0.15, 0.25]];
const NB_LAB = [['Cerisier hors saison', 'Cerisier véraison', 'Cerisier véraison'], ['Forêt', 'Case source', 'Cerisier véraison'], ['Neutre', 'Neutre', 'Cerisier hors saison']];
const nbCol = (v: number | null) => (v === null ? '#0F172A' : v >= 3 ? '#E11D48' : v >= 0.5 ? '#15803D' : v >= 0.2 ? '#D97706' : '#CBD5E1');
const NB_SUM = NB_W.flat().reduce<number>((a, b) => a + (b ?? 0), 0);
const NB_CELLS = NB_W.flatMap((row, y) => row.map((v, x) => ({
  key: `${x}${y}`, x, y, v, fill: nbCol(v), label: NB_LAB[y][x],
  x2: 63 + x * 90 + (x - 1) * -28, y2: 63 + y * 90 + (y - 1) * -28,
})));

/** Voisinage de dispersion 3×3 */
@Component({
  selector: 'ds-neighborhood-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './neighborhood-diagram.component.html',
})
export class NeighborhoodDiagram {
  protected id = uid();
  protected cells = NB_CELLS;
  protected sum = NB_SUM;
  protected max1 = (v: number) => Math.max(1, v);
}
