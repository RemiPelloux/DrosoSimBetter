import { Component, ElementRef, computed, effect, input, signal, viewChild } from '@angular/core';
import { IsoOrchard, RingGauge } from '@/components/art';
import { Motion, LayoutId, motionAnimate } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { type Run, DEMO_GRID, EASE_OUT_EXPO } from './home.utils';

@Component({
  selector: 'ds-home-hero-orchard',
  imports: [Motion, LayoutId, IsoOrchard, RingGauge],
  host: { style: 'display: contents' },
  templateUrl: './hero-orchard.component.html',
})
export class HeroOrchard {
  readonly run = input.required<Run>();
  protected grid = DEMO_GRID;
  protected cn = cn;
  protected ease = EASE_OUT_EXPO;
  protected inf = Infinity;
  protected views = ['base', 'pbi'] as const;
  protected view = signal<'base' | 'pbi'>('base');
  /** Carte affichée : suit `view` après l'animation de sortie (AnimatePresence mode="wait") */
  protected shown = signal<'base' | 'pbi'>('base');
  private auto = signal(true);
  private card = viewChild<ElementRef<HTMLElement>>('card');
  protected r = computed(() => (this.view() === 'base' ? this.run().base : this.run().pbi));
  protected shownR = computed(() => (this.shown() === 'base' ? this.run().base : this.run().pbi));
  protected gain = computed(() => this.run().pbi.revenue - this.run().base.revenue - this.run().pbi.totalCost);
  private exitToken = 0;

  constructor() {
    effect(onCleanup => {
      if (!this.auto()) return;
      const t = setInterval(() => this.view.update(v => (v === 'base' ? 'pbi' : 'base')), 3800);
      onCleanup(() => clearInterval(t));
    });
    // sortie de l'ancienne carte, puis entrée de la nouvelle
    effect(() => {
      const v = this.view();
      if (v === this.shown()) return;
      const token = ++this.exitToken;
      const el = this.card()?.nativeElement;
      const done = () => { if (token === this.exitToken) this.shown.set(this.view()); };
      if (!el) { done(); return; }
      motionAnimate(el, { opacity: 0, x: -10 }, { duration: 0.35 }).then(done, done);
    });
  }

  protected pick(v: 'base' | 'pbi') { this.auto.set(false); this.view.set(v); }
}
