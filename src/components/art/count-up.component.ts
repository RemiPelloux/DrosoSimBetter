import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { animate, inView } from 'framer-motion/dom';
import { cn } from '@/lib/utils';

/** Nombre qui « monte » à l'affichage (et se ré-anime quand la valeur change) */
@Component({
  selector: 'ds-count-up',
  host: { style: 'display: contents' },
  templateUrl: './count-up.component.html',
})
export class CountUp {
  readonly value = input.required<number>();
  readonly decimals = input(0);
  readonly prefix = input('');
  readonly suffix = input('');
  readonly className = input<string>();
  readonly duration = input(1.1);
  readonly signed = input(false);
  protected cn = cn;
  private el = viewChild.required<ElementRef<HTMLSpanElement>>('el');
  protected zeroText = computed(() => this.fmt(0));

  private fmt(v: number) {
    const d = this.decimals();
    const s = Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return `${this.signed() && v > 0 ? '+' : v < 0 ? '−' : ''}${this.prefix()}${s}${this.suffix()}`;
  }

  constructor() {
    let from = 0;
    let seen = false;
    let stopAnim: { stop: () => void } | undefined;
    let stopView: VoidFunction | undefined;
    const run = () => {
      const node = this.el().nativeElement;
      const value = this.value();
      stopAnim?.stop();
      stopAnim = animate(from, value, { duration: this.duration(), ease: [0.16, 1, 0.3, 1], onUpdate: v => { node.textContent = this.fmt(v); } });
      from = value;
    };
    afterNextRender(() => {
      const node = this.el().nativeElement;
      node.textContent = this.fmt(0);
      stopView = inView(node, () => { seen = true; stopView?.(); run(); }, { margin: '-20px' });
    });
    effect(() => {
      this.value();
      untracked(() => { if (seen) run(); });
    });
    inject(DestroyRef).onDestroy(() => { stopAnim?.stop(); stopView?.(); });
  }
}
