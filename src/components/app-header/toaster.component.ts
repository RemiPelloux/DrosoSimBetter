import { Component } from '@angular/core';
import { Check, AlertCircle } from 'lucide';
import { cn } from '@/lib/utils';
import { toasts } from '@/lib/toast';
import { Lucide } from '../ui/lucide';
import { Motion } from '../ui/motion';

// ------------------------------------------------------------------ Toasts
@Component({
  selector: 'ds-toaster',
  imports: [Lucide, Motion],
  host: { style: 'display: contents' },
  templateUrl: './toaster.component.html',
})
export class Toaster {
  protected items = toasts;
  protected I = { Check, AlertCircle };
  protected cn = cn;
}
