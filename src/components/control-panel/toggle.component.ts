import { Component, input, output } from '@angular/core';
import { cn } from '@/lib/utils';

@Component({
  selector: 'ds-toggle',
  host: { style: 'display: contents' },
  templateUrl: './toggle.component.html',
})
export class Toggle {
  readonly label = input.required<string>();
  readonly value = input.required<boolean>();
  readonly valueChange = output<boolean>();
  protected cn = cn;
}
