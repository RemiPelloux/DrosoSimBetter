import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Toaster, GlobalDropZone } from '@/components/AppHeader';
import { motionAnimate } from '@/components/ui/motion';

/** Racine : page courante (fondu d'entrée à chaque navigation), notifications et zone de dépôt globale. */
@Component({
  selector: 'ds-root',
  imports: [RouterOutlet, Toaster, GlobalDropZone],
  template: `
    <div #page class="flex min-h-full flex-1 flex-col" style="opacity: 0"><router-outlet /></div>
    <ds-toaster />
    <ds-global-drop-zone />
  `,
})
export class App {
  private page = viewChild.required<ElementRef<HTMLElement>>('page');
  private lastPath = '';
  constructor() {
    // Transition douce entre les pages (opacité seule : ne casse ni sticky ni fixed)
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      const path = (e as NavigationEnd).urlAfterRedirects.split(/[?#]/)[0];
      if (path === this.lastPath) return;
      this.lastPath = path;
      motionAnimate(this.page().nativeElement, { opacity: 1 }, { duration: 0.28, ease: 'easeOut' }, { opacity: 0 });
    });
  }
}
