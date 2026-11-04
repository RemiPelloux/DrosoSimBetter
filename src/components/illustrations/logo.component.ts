import { Component, input } from '@angular/core';
import { Motion } from '../ui/motion';

/** Logo : feuille + cerise + œil de drosophile */
@Component({
  selector: 'ds-logo',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './logo.component.html',
})
export class Logo {
  readonly size = input(36);
  readonly animated = input(true);
}
