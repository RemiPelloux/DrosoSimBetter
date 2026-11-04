import { Component, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { Lever } from './control-panel.utils';

@Component({
  selector: 'ds-adv',
  imports: [NgComponentOutlet],
  host: { style: 'display: contents' },
  templateUrl: './adv.component.html',
})
export class Adv {
  readonly l = input.required<Lever>();
}
