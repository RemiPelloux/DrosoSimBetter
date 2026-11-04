import { Component, input, output } from '@angular/core';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------ Bouton d'en-tête
@Component({
  selector: 'ds-hbtn',
  host: { '[attr.title]': 'null', style: 'display: contents' },
  templateUrl: './h-btn.component.html',
})
export class HBtn {
  readonly disabled = input(false);
  readonly title = input.required<string>();
  readonly label = input<string>();
  readonly outline = input(false);
  readonly hideBelowSm = input(false);
  readonly press = output<void>();
  protected cn = cn;
}
