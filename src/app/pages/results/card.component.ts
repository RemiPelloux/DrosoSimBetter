import { Component, input } from '@angular/core';
import { Motion } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { AnyIcon } from './any-icon.component';
import { type AnyIconT, EASE } from './results.utils';

/** Carte de section ; contenu projeté `[right]` (enveloppé par l'appelant dans un div.no-print). */
@Component({
  selector: 'ds-card',
  imports: [Motion, AnyIcon],
  host: { style: 'display: contents' },
  templateUrl: './card.component.html',
})
export class Card {
  readonly heading = input.required<string>();
  readonly icon = input.required<AnyIconT>();
  readonly subtitle = input<string>();
  readonly className = input<string>();
  protected cn = cn;
  protected ease = EASE;
}
