import { Component } from '@angular/core';
import { BuzzingFly } from '@/components/illustrations';

@Component({
  selector: 'ds-skeleton-results',
  imports: [BuzzingFly],
  host: { style: 'display: contents' },
  templateUrl: './skeleton-results.component.html',
})
export class SkeletonResults {}
