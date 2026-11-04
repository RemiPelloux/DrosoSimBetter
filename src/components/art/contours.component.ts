import { Component, input } from '@angular/core';
import { Motion } from '../ui/motion';

const CONTOUR_PATHS = Array.from({ length: 14 }, (_, i) => ({
  d: `M -50 ${60 + i * 24} C 150 ${20 + i * 26}, 300 ${120 + i * 20}, 450 ${70 + i * 25} S 700 ${10 + i * 28}, 850 ${80 + i * 22}`,
  op: 0.12 + (i % 3) * 0.04,
  transition: { duration: 2.2, delay: i * 0.06 },
}));

/** Lignes topographiques décoratives */
@Component({
  selector: 'ds-contours',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './contours.component.html',
})
export class Contours {
  readonly className = input<string>();
  readonly color = input('#10B981');
  protected paths = CONTOUR_PATHS;
}
