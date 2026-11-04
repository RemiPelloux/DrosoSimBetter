import { Component, ElementRef, afterNextRender, input, viewChild } from '@angular/core';
import { animate as fmAnimate } from 'framer-motion/dom';
import { motionAnimate } from '../ui/motion';

/** Drosophila suzukii mâle stylisée (taches alaires caractéristiques), ailes animées. */
@Component({
  selector: 'ds-drosophila',
  host: { style: 'display: contents' },
  templateUrl: './drosophila.component.html',
})
export class Drosophila {
  readonly size = input(48);
  readonly animate = input(true);
  readonly className = input<string>();
  readonly spots = input(true);
  private wingL = viewChild.required<ElementRef<SVGGElement>>('wingL');
  private wingR = viewChild.required<ElementRef<SVGGElement>>('wingR');

  constructor() {
    afterNextRender(() => {
      const wings: [SVGGElement, string, number[]][] = [
        [this.wingL().nativeElement, '32px', [0, -18, 0, 14, 0]],
        [this.wingR().nativeElement, '34px', [0, 18, 0, -14, 0]],
      ];
      for (const [el, ox, rotate] of wings) {
        // pivot des ailes (style={{ originX, originY }} de framer-motion)
        fmAnimate(el, { originX: ox, originY: '28px' } as never, { duration: 0 });
        if (this.animate()) motionAnimate(el, { rotate }, { duration: 0.12, repeat: 1e9 });
      }
    });
  }
}
