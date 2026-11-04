import { Component, input } from '@angular/core';
import { type IconNode } from 'lucide';
import { Lucide } from '@/components/ui/lucide';

/** Panneau titré ; contenu projeté `[right]` à droite du titre. */
@Component({
  selector: 'ds-panel',
  imports: [Lucide],
  host: { style: 'display: contents' },
  templateUrl: './panel.component.html',
})
export class Panel {
  readonly heading = input.required<string>();
  readonly icon = input.required<IconNode>();
}
