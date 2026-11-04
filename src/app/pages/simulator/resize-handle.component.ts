import { Component, output } from '@angular/core';
import { GripVertical } from 'lucide';
import { Lucide } from '@/components/ui/lucide';

// ------------------------------------------------------------------ Atomes
@Component({
  selector: 'ds-resize-handle',
  imports: [Lucide],
  host: { style: 'display: contents' },
  templateUrl: './resize-handle.component.html',
})
export class ResizeHandle {
  readonly down = output<PointerEvent>();
  readonly reset = output<void>();
  protected I = { GripVertical };
}
