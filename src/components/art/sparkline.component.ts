import { Component, computed, input } from '@angular/core';
import { Motion } from '../ui/motion';
import { uid } from './art.utils';

/** Mini-courbe (sparkline) avec aire dégradée */
@Component({
  selector: 'ds-sparkline',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './sparkline.component.html',
})
export class Sparkline {
  readonly data = input.required<number[]>();
  readonly color = input('#10B981');
  readonly width = input(140);
  readonly height = input(36);
  readonly className = input<string>();
  readonly max = input<number>();
  protected id = uid();
  protected paths = computed(() => {
    const data = this.data(), width = this.width(), height = this.height();
    if (!data.length) return { line: '', area: '' };
    const max = this.max() ?? Math.max(...data, 1);
    const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * width, height - 2 - (v / max) * (height - 4)]);
    const l = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { line: l, area: `${l} L${width} ${height} L0 ${height} Z` };
  });
}
