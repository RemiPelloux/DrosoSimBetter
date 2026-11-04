import { Component, computed, input, type Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { type IconNode } from 'lucide';
import { Lucide } from '../ui/lucide';

// ------------------------------------------------------------------ UI atoms
@Component({
  selector: 'ds-field',
  imports: [Lucide, NgComponentOutlet],
  host: { style: 'display: contents' },
  templateUrl: './field.component.html',
})
export class Field {
  readonly label = input.required<string>();
  /** Icône Lucide (IconNode) ou composant d'icône maison. */
  readonly icon = input.required<IconNode | Type<unknown>>();
  protected node = computed(() => { const i = this.icon(); return Array.isArray(i) ? i as IconNode : null; });
  protected comp = computed(() => { const i = this.icon(); return Array.isArray(i) ? null : i as Type<unknown>; });
}
