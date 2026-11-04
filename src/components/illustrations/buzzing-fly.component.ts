import { Component, input } from '@angular/core';
import { Motion } from '../ui/motion';
import { Drosophila } from './drosophila.component';

/** Mouche qui « bourdonne » sur place (états vides, chargements) */
@Component({
  selector: 'ds-buzzing-fly',
  imports: [Motion, Drosophila],
  host: { style: 'display: contents' },
  templateUrl: './buzzing-fly.component.html',
})
export class BuzzingFly {
  readonly size = input(56);
}
