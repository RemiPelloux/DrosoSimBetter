import { Component, input } from '@angular/core';

const GRAIN_BG = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Grain papier (texture) */
@Component({
  selector: 'ds-grain',
  host: { style: 'display: contents' },
  templateUrl: './grain.component.html',
})
export class Grain {
  readonly opacity = input(0.06);
  protected bg = GRAIN_BG;
}
