import { type ApplicationConfig, Injectable, provideBrowserGlobalErrorListeners } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { provideRouter, TitleStrategy, withInMemoryScrolling, withComponentInputBinding, type RouterStateSnapshot } from '@angular/router';
import { routes } from './app.routes';

const SUFFIX = ' — DrosoSim Next';
const DEFAULT_TITLE = 'DrosoSim Next — Simulateur de protection des vergers contre Drosophila suzukii';
const DEFAULT_DESC = "Simulateur pédagogique d'aide à la décision : dessinez votre verger de cerisiers, combinez filets, prophylaxie, traitements, parasitoïdes et TIS, comparez les stratégies au témoin sur 1 à 3 ans (récolte saine, bilan économique, IFT).";

/** Titre « %s — DrosoSim Next » et description par page (équivalent des metadata Next.js). */
@Injectable({ providedIn: 'root' })
class PageTitleStrategy extends TitleStrategy {
  constructor(private title: Title, private meta: Meta) { super(); }
  override updateTitle(state: RouterStateSnapshot) {
    const t = this.buildTitle(state);
    this.title.setTitle(t ? t + SUFFIX : DEFAULT_TITLE);
    let r = state.root; while (r.firstChild) r = r.firstChild;
    this.meta.updateTag({ name: 'description', content: (r.data['description'] as string | undefined) ?? DEFAULT_DESC });
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'top' })),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
  ],
};
