import { Component, computed, input } from '@angular/core';
import { Motion } from '../ui/motion';
import { uid } from './art.utils';

/** Jauge circulaire animée */
@Component({
  selector: 'ds-ring-gauge',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './ring-gauge.component.html',
})
export class RingGauge {
  readonly value = input.required<number>();
  readonly max = input(100);
  readonly size = input(92);
  readonly stroke = input(9);
  readonly color = input('#10B981');
  readonly track = input('#E2E8F0');
  protected id = uid();
  protected r = computed(() => (this.size() - this.stroke()) / 2);
  protected c = computed(() => 2 * Math.PI * this.r());
  protected pct = computed(() => Math.max(0, Math.min(1, this.value() / this.max())));
}
