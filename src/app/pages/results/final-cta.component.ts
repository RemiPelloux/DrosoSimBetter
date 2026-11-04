import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Printer } from 'lucide';
import { Grain, Contours } from '@/components/art';
import { Lucide } from '@/components/ui/lucide';

@Component({
  selector: 'ds-final-cta',
  imports: [RouterLink, Lucide, Contours, Grain],
  host: { style: 'display: contents' },
  templateUrl: './final-cta.component.html',
})
export class FinalCta {
  protected I = { Printer };
  protected print() { window.print(); }
}
