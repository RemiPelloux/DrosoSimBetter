import { Component, computed, input } from '@angular/core';
import { GRID_N, type CellType } from '@/lib/store';
import { CELL_BG } from './grid-editor.utils';

// ------------------------------------------------------------------ Mini-carte
@Component({
  selector: 'ds-mini-map',
  host: { style: 'display: contents' },
  templateUrl: './mini-map.component.html',
})
export class MiniMap {
  readonly grid = input.required<CellType[]>();
  readonly values = input<Float32Array | number[]>();
  readonly max = input<number>();
  readonly size = input(200);
  protected cols = `repeat(${GRID_N}, 1fr)`;
  protected cells = computed(() => {
    const values = this.values(), max = this.max();
    return this.grid().map((t, i) => {
      if (!values) return { plain: true, cls: t === 'forest' ? 'hatch' : '', bg: CELL_BG[t], title: '', shadow: null };
      const v = Math.min(1, (values[i] ?? 0) / (max || 1));
      return { plain: false, cls: '', bg: heat(v), title: `${Math.round(values[i] ?? 0).toLocaleString('fr-FR')} femelles/ha`, shadow: t !== 'neutral' ? `inset 0 0 0 1px ${CELL_BG[t]}55` : null };
    });
  });
}

export function heat(v: number) {
  // vert → jaune → orange → rouge
  const stops = [[240, 253, 244], [253, 224, 71], [249, 115, 22], [185, 28, 28]];
  const x = Math.max(0, Math.min(1, v)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const c = stops[i].map((s, k) => Math.round(s + (stops[i + 1][k] - s) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
