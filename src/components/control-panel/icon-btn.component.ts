import { Component, input, output } from '@angular/core';
import { cn } from '@/lib/utils';

@Component({
  selector: 'ds-icon-btn',
  host: { '[attr.title]': 'null', style: 'display: contents' },
  templateUrl: './icon-btn.component.html',
})
export class IconBtn {
  readonly title = input.required<string>();
  readonly danger = input(false);
  readonly press = output<void>();
  protected cn = cn;
}
