import { Component } from '@angular/core';
import { Motion } from '../ui/motion';

const PX = (doy: number) => 40 + (doy / 365) * 640;
const PH_MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => ({ m, x: PX(i * 30.4), tx: PX(i * 30.4 + 15) }));
const PH_BANDS = [
  { l: 'Précoce', a: 130, b: 158, c: '#D97706', y: 168 },
  { l: 'Saison', a: 150, b: 178, c: '#E11D48', y: 190 },
  { l: 'Tardive', a: 168, b: 200, c: '#991B1B', y: 212 },
].map(b => ({ ...b, x: PX(b.a), w: PX(b.b) - PX(b.a), tx: PX(b.b) + 6 }));
// courbe type de pression (forme indicative)
const PH_PTS = Array.from({ length: 74 }, (_, i) => {
  const d = i * 5;
  const v = Math.exp(-Math.pow((d - 215) / 38, 2)) * 0.95 + Math.exp(-Math.pow((d - 290) / 45, 2)) * 0.35 + 0.04;
  return `${PX(d)},${150 - v * 120}`;
}).join(' ');

/** Frise phénologique annuelle avec courbe de pression type */
@Component({
  selector: 'ds-phenology-timeline',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './phenology-timeline.component.html',
})
export class PhenologyTimeline {
  protected months = PH_MONTHS;
  protected bands = PH_BANDS;
  protected pts = PH_PTS;
  protected X = PX;
}
