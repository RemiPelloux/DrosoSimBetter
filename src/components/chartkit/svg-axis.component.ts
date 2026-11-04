import { Component, input } from '@angular/core';
import type { Box, TickItem, TextSpec } from './chartkit.utils';
import { SvgText } from './svg-text.component';

export interface AxisSpec {
  box: Box;
  orient: 'bottom' | 'left';
  ticks: TickItem[];
  fontSize: number;
  fill: string;
  fontWeight?: number;
  /** Graduation personnalisée sur deux lignes (WrapTick) */
  wrap?: boolean;
  label?: TextSpec | null;
}

@Component({
  selector: 'g[dsAxis]',
  imports: [SvgText],
  host: { '[attr.class]': '"recharts-layer recharts-cartesian-axis recharts-" + (a().orient === "bottom" ? "xAxis xAxis" : "yAxis yAxis")' },
  templateUrl: './svg-axis.component.html',
})
export class SvgAxis {
  readonly a = input.required<AxisSpec>({ alias: 'dsAxis' });
}
