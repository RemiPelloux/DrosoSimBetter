import { Component, input } from '@angular/core';
import { type IconNode } from 'lucide';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';

@Component({
  selector: 'ds-home-step-card',
  imports: [Motion, Lucide],
  host: { '[attr.title]': 'null', style: 'display: contents' },
  templateUrl: './step-card.component.html',
})
export class StepCard {
  readonly i = input.required<number>();
  readonly icon = input.required<IconNode>();
  readonly title = input.required<string>();
  readonly text = input.required<string>();
}
