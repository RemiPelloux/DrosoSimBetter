import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { cn } from '@/lib/utils';

// ======================================================================= Blocs
const CHAPTERS = [
  { id: 'synthese', n: '01', label: 'Synthèse' }, { id: 'recolte', n: '02', label: 'Récolte' }, { id: 'dynamique', n: '03', label: 'Dynamique' },
  { id: 'economie', n: '04', label: 'Économie' }, { id: 'territoire', n: '05', label: 'Territoire' }, { id: 'leviers', n: '06', label: 'Décision' },
];

@Component({
  selector: 'ds-chapter-nav',
  host: { style: 'display: contents' },
  templateUrl: './chapter-nav.component.html',
})
export class ChapterNav {
  protected chapters = CHAPTERS;
  protected active = signal('synthese');
  protected progress = signal(0);
  protected cn = cn;
  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const els = CHAPTERS.map(c => document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
      const obs = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) this.active.set(e.target.id); }); }, { rootMargin: '-35% 0px -60% 0px' });
      els.forEach(e => obs.observe(e));
      const onScroll = () => { const h = document.documentElement; this.progress.set(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)); };
      window.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => { obs.disconnect(); window.removeEventListener('scroll', onScroll); });
    });
  }
  /** Ancre « #id » : défilement doux sans passer par le routeur (qui réécrirait l'URL de la page). */
  protected jump(e: MouseEvent, id: string) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView(); // suit scroll-behavior (doux, sauf mouvement réduit)
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${id}`);
  }
}
