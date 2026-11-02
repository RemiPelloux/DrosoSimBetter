import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import type { IconNode } from 'lucide';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULTS: Record<string, string> = {
  xmlns: SVG_NS, width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
};

/**
 * Icône Lucide (mêmes tracés que lucide-react) : `<svg [lucide]="I.ChevronDown" class="h-4 w-4"></svg>`.
 * Les attributs posés explicitement sur l'élément (width, stroke-width…) sont conservés.
 */
@Directive({ selector: 'svg[lucide]', host: { 'aria-hidden': 'true' } })
export class Lucide {
  readonly lucide = input.required<IconNode>();
  private el = inject<ElementRef<SVGSVGElement>>(ElementRef).nativeElement;
  private initial = new Set(Array.from(this.el.attributes).map(a => a.name));

  constructor() {
    effect(() => {
      const node = this.lucide();
      for (const [k, v] of Object.entries(DEFAULTS)) if (!this.initial.has(k)) this.el.setAttribute(k, v);
      this.el.classList.add('lucide');
      this.el.replaceChildren(...node.map(([tag, attrs]) => {
        const c = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) if (v !== undefined) c.setAttribute(k, String(v));
        return c;
      }));
    });
  }
}
