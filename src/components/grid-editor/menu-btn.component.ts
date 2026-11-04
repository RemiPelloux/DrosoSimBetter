import { Component, input, output } from '@angular/core';
import { type IconNode } from 'lucide';
import { cn } from '@/lib/utils';
import { Lucide } from '../ui/lucide';

// ------------------------------------------------------------------ Bouton du menu d'édition
@Component({
  selector: 'ds-menu-btn',
  imports: [Lucide],
  host: { style: 'display: contents' },
  templateUrl: './menu-btn.component.html',
})
export class MenuBtn {
  readonly icon = input.required<IconNode>();
  readonly danger = input(false);
  readonly press = output<void>();
  protected cn = cn;
}
