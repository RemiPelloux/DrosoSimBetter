import { Component, computed, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { Lucide } from '@/components/ui/lucide';
import type { AnyIconT } from './results.utils';

// ======================================================================= Atomes
@Component({
  selector: 'ds-any-icon',
  imports: [Lucide, NgComponentOutlet],
  host: { style: 'display: contents' },
  templateUrl: './any-icon.component.html',
})
export class AnyIcon {
  readonly icon = input.required<AnyIconT>();
  readonly className = input('');
  protected isNode = computed(() => Array.isArray(this.icon()));
}
