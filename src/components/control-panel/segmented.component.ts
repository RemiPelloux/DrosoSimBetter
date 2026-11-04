import { Component, input, output } from '@angular/core';
import { cn } from '@/lib/utils';

@Component({
  selector: 'ds-segmented',
  host: { style: 'display: contents' },
  templateUrl: './segmented.component.html',
})
export class Segmented<T extends string> {
  readonly value = input.required<T>();
  readonly options = input.required<{ v: T; l: string }[]>();
  readonly valueChange = output<T>();
  protected cn = cn;
}
