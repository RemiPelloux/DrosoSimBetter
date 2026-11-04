import { Component } from '@angular/core';
import { Motion } from '../ui/motion';
import { uid } from './illustrations.utils';

const LIFE_STAGES = [
  { x: 300, y: 50, l: 'Œuf', s: 'pondu dans le fruit', c: '#FEF3C7', e: '🥚' },
  { x: 520, y: 170, l: 'Larve', s: 'se nourrit de la pulpe', c: '#FFEDD5', e: '🐛' },
  { x: 300, y: 290, l: 'Pupe', s: 'dans ou hors du fruit', c: '#FDE68A', e: '🫘' },
  { x: 80, y: 170, l: 'Adulte ♀', s: 'vit ~3-9 semaines', c: '#DCFCE7', e: '🪰' },
];
const LIFE_ARROWS = [[360, 70, 500, 140], [500, 210, 360, 280], [240, 280, 100, 210], [100, 135, 240, 65]]
  .map(([x1, y1, x2, y2], i) => `M${x1} ${y1} Q ${(x1 + x2) / 2 + (i % 2 ? -30 : 30)} ${(y1 + y2) / 2} ${x2} ${y2}`);

/** Cycle biologique : œuf → larve → pupe → adulte, avec flux du modèle */
@Component({
  selector: 'ds-life-cycle-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './life-cycle-diagram.component.html',
})
export class LifeCycleDiagram {
  protected id = uid();
  protected stages = LIFE_STAGES;
  protected arrows = LIFE_ARROWS;
}
