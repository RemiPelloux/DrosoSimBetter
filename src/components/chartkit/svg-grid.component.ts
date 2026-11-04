import { Component, input } from '@angular/core';
import type { Box } from './chartkit.utils';

/** Lignes horizontales de la grille (CartesianGrid vertical={false}). */
@Component({
  selector: 'g[dsGrid]',
  host: { class: 'recharts-cartesian-grid' },
  templateUrl: './svg-grid.component.html',
})
export class SvgGrid {
  readonly plot = input.required<Box>({ alias: 'dsGrid' });
  readonly ys = input.required<number[]>();
}
