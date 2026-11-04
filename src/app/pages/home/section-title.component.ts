import { Component, input } from '@angular/core';
import { Motion } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

// ======================================================================= Composants
@Component({
  selector: 'ds-home-section-title',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './section-title.component.html',
})
export class SectionTitle {
  readonly n = input.required<string>();
  readonly kicker = input.required<string>();
  readonly align = input<'center' | 'left'>('center');
  readonly dark = input(false);
  protected cn = cn;
}
