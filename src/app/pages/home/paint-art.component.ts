import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { inView } from 'framer-motion/dom';
import { Paintbrush } from 'lucide';
import { buildTemplate } from '@/lib/store';
import { Lucide } from '@/components/ui/lucide';
import { Motion, motionAnimate } from '@/components/ui/motion';

/** Mini-animation : la grille se peint toute seule */
@Component({
  selector: 'ds-home-paint-art',
  imports: [Motion, Lucide],
  host: { style: 'display: contents' },
  templateUrl: './paint-art.component.html',
})
export class PaintArt {
  protected g = buildTemplate('enclosed');
  protected I = { Paintbrush };
  private grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  constructor() {
    const COL: Record<string, string> = { neutral: '#EDE7D6', forest: '#2F6B3A', 'early-cherry': '#D97706', 'season-cherry': '#E11D48', 'late-cherry': '#991B1B' };
    let stop: VoidFunction | undefined;
    // un seul observateur pour les 400 cases (équivalent de whileInView once sur chaque case)
    afterNextRender(() => {
      const el = this.grid().nativeElement;
      stop = inView(el, () => {
        Array.from(el.children).forEach((c, k) => motionAnimate(c, { backgroundColor: COL[this.g[k]] }, { delay: 0.3 + ((k % 20) + Math.floor(k / 20)) * 0.035, duration: 0.25 }, { backgroundColor: '#EDE7D6' }));
        stop?.();
      });
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }
}
