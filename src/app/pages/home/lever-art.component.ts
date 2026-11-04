import { Component } from '@angular/core';
import { Motion } from '@/components/ui/motion';

/** Mini-animation : interrupteurs de leviers */
@Component({
  selector: 'ds-home-lever-art',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './lever-art.component.html',
})
export class LeverArt {
  protected items = [['Filet', '#2563EB'], ['Prophylaxie', '#0D9488'], ['Parasitoïdes', '#7C3AED'], ['TIS', '#DB2777']];
}
