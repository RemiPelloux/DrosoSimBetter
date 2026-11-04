import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { CellType } from '@/lib/engine';
import { Motion } from '../ui/motion';

// -----------------------------------------------------------------------------
// Verger isométrique — rendu artistique du parcellaire réel
// -----------------------------------------------------------------------------
const GROUND: Record<CellType, [string, string]> = {
  neutral: ['#E9E4D4', '#D8D1BC'],
  forest: ['#2F6B3A', '#245530'],
  'early-cherry': ['#9BBF6A', '#86AB57'],
  'season-cherry': ['#93BA63', '#7FA553'],
  'late-cherry': ['#8AB35E', '#76A04E'],
};
const FRUIT: Record<CellType, string> = { neutral: '', forest: '', 'early-cherry': '#F59E0B', 'season-cherry': '#E11D48', 'late-cherry': '#7F1D1D' };
const FRUIT_POS = [[-6, -24], [5, -18], [2, -29], [-3, -15], [8, -26]];

function heatColor(v: number) {
  const stops = [[254, 240, 138], [249, 115, 22], [190, 18, 60]];
  const x = Math.max(0, Math.min(1, v)) * 2, i = Math.min(1, Math.floor(x)), f = x - i;
  const c = stops[i].map((s, k) => Math.round(s + (stops[i + 1][k] - s) * f));
  return `rgb(${c.join(',')})`;
}

const W = 34, H = 17; // demi-losange

@Component({
  selector: 'ds-iso-orchard',
  imports: [Motion, NgTemplateOutlet],
  host: { style: 'display: contents' },
  templateUrl: './iso-orchard.component.html',
})
export class IsoOrchard {
  readonly grid = input.required<CellType[]>();
  readonly heat = input<Float32Array | number[]>();
  readonly max = input<number>();
  readonly className = input<string>();
  readonly flies = input(true);
  readonly n = input(20);

  protected fruitPos = FRUIT_POS;
  protected flyTarget = { opacity: 1, x: [0, 6, -5, 3, 0], y: [0, -6, 2, -3, 0] };
  protected viewBox = computed(() => `0 0 ${2 * this.n() * W} ${2 * this.n() * H + 90}`);

  private P(x: number, y: number) { return [this.n() * W + (x - y) * W, 40 + (x + y) * H] as const; }

  protected base = computed(() => {
    const n = this.n();
    const P = (x: number, y: number) => this.P(x, y);
    return {
      top: `M${P(0, 0)[0]} ${P(0, 0)[1] - H} L${P(n, 0)[0] + 0} ${P(n, 0)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(0, n)[0]} ${P(0, n)[1] - H} Z`,
      front: `M${P(0, n)[0]} ${P(0, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H + 22} L${P(0, n)[0]} ${P(0, n)[1] - H + 22} Z`,
      side: `M${P(n, 0)[0]} ${P(n, 0)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H + 22} L${P(n, 0)[0]} ${P(n, 0)[1] - H + 22} Z`,
    };
  });

  protected cells = computed(() => {
    const n = this.n(), grid = this.grid(), heat = this.heat(), max = this.max();
    const out: { i: number; x: number; y: number; t: CellType; v: number; d: string; ground: string; heat: string; tr: string; fruit: string }[] = [];
    for (let s = 0; s < 2 * n - 1; s++) for (let x = 0; x < n; x++) {
      const y = s - x; if (y < 0 || y >= n) continue;
      const i = y * n + x;
      const t = grid[i];
      const v = heat && max ? Math.min(1, (heat[i] ?? 0) / max) : 0;
      const [cx, cy] = this.P(x, y);
      const top = cy - H;
      const g = GROUND[t];
      out.push({
        i, x, y, t, v,
        d: `M${cx} ${top - H} L${cx + W} ${top} L${cx} ${top + H} L${cx - W} ${top} Z`,
        ground: (x + y) % 2 ? g[0] : g[1],
        heat: v > 0.05 && t !== 'neutral' ? heatColor(v) : '',
        tr: `translate(${cx} ${top})`,
        fruit: FRUIT[t],
      });
    }
    return out;
  });

  /** Mouches dans un calque séparé quand le verger porte une ombre portée (voir le template). */
  protected splitFlies = computed(() => this.flies() && /drop-shadow/.test(this.className() ?? ''));

  protected hot = computed(() => this.cells().filter(c => c.v > 0.55 && c.t !== 'neutral').sort((a, b) => b.v - a.v).slice(0, 14));

  protected flyTransform(c: { x: number; y: number }, k: number) {
    const [cx, cy] = this.P(c.x, c.y);
    return `translate(${cx + ((k * 7) % 14) - 7} ${cy - H - 52 - (k % 3) * 8})`;
  }
}
