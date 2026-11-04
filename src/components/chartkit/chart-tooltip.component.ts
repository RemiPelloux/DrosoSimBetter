import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import type { Box } from './chartkit.utils';

// ---------------------------------------------------------------- Info-bulle
/** Boîte d'info-bulle positionnée comme TooltipBoundingBox (offset 10, sans sortir de la zone du graphique). */
@Component({
  selector: 'ds-chart-tooltip',
  host: { style: 'display: contents' },
  templateUrl: './chart-tooltip.component.html',
})
export class ChartTooltip {
  readonly coord = input<{ x: number; y: number } | null>(null);
  readonly viewBox = input.required<Box>();
  private box = viewChild.required<ElementRef<HTMLDivElement>>('box');
  private destroyRef = inject(DestroyRef);
  private size = signal({ w: 0, h: 0 });
  private last = signal<{ x: number; y: number } | null>(null);
  protected animated = signal(false);

  constructor() {
    // taille de la boîte via ResizeObserver : la lire (offsetWidth) après chaque rendu forçait
    // une mise en page synchrone de toute la page à chaque mouvement de souris
    afterNextRender(() => {
      const ro = new ResizeObserver(([entry]) => {
        const b = entry.borderBoxSize?.[0];
        const w = b ? b.inlineSize : (entry.target as HTMLElement).offsetWidth;
        const h = b ? b.blockSize : (entry.target as HTMLElement).offsetHeight;
        const s = untracked(this.size);
        if (s.w !== w || s.h !== h) this.size.set({ w, h });
      });
      ro.observe(this.box().nativeElement);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
    effect(() => {
      const p = this.pos();
      if (p) untracked(() => { if (this.last()) this.animated.set(true); this.last.set(p); });
    });
  }

  protected visible = computed(() => !!this.coord() && this.size().w > 0 && this.size().h > 0);
  private pos = computed(() => {
    const c = this.coord();
    const { w, h } = this.size();
    const vb = this.viewBox();
    if (!c || !w || !h) return null;
    const at = (key: 'x' | 'y', dim: number, vbDim: number) => {
      const negative = c[key] - dim - 10, positive = c[key] + 10;
      if (positive + dim > vb[key] + vbDim) return Math.max(negative, vb[key]);
      return Math.max(positive, vb[key]);
    };
    return { x: at('x', w, vb.width), y: at('y', h, vb.height) };
  });
  protected transform = computed(() => { const p = this.pos() ?? this.last(); return p ? `translate(${p.x}px, ${p.y}px)` : null; });
}
