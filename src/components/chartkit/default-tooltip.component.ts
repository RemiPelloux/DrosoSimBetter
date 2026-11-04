import { Component, input } from '@angular/core';

export interface TipItem { name?: string; value: string; color: string }

/** Contenu par défaut de l'info-bulle (DefaultTooltipContent + contentStyle { borderRadius: 12, fontSize: 12 }). */
@Component({
  selector: 'ds-default-tooltip',
  host: { style: 'display: contents' },
  templateUrl: './default-tooltip.component.html',
})
export class DefaultTooltip {
  readonly label = input<string>('');
  readonly items = input<TipItem[]>([]);
}
