import { Component, input } from '@angular/core';

const HILL_TREES = Array.from({ length: 26 }, (_, i) => `translate(${40 + i * 54} ${205 - Math.sin(i / 3) * 18})`);

/** Paysage décoratif : collines, rangs de cerisiers, soleil */
@Component({
  selector: 'ds-hills-backdrop',
  host: { style: 'display: contents' },
  templateUrl: './hills-backdrop.component.html',
})
export class HillsBackdrop {
  readonly className = input<string>();
  protected trees = HILL_TREES;
}
