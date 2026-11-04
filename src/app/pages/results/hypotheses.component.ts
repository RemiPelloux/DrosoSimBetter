import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Info, ChevronDown } from 'lucide';
import { Lucide } from '@/components/ui/lucide';
import { cn } from '@/lib/utils';

@Component({
  selector: 'ds-hypotheses',
  imports: [RouterLink, Lucide],
  host: { style: 'display: contents' },
  templateUrl: './hypotheses.component.html',
})
export class Hypotheses {
  protected open = signal(false);
  protected I = { Info, ChevronDown };
  protected cn = cn;
}
