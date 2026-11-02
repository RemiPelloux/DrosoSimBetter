import { Component, computed, input } from '@angular/core';
import { getDocs } from '@/lib/docs';
import { DocsShell } from '@/components/DocsShell';
import { NotFoundPage } from './not-found';

/** Chapitre de documentation : le slug vient des données de la route (voir app.routes.ts). */
@Component({
  selector: 'ds-docs-page',
  imports: [DocsShell, NotFoundPage],
  host: { style: 'display: contents' },
  template: `
    @if (doc(); as d) { <ds-docs-shell [doc]="d" [nav]="nav" /> } @else { <ds-not-found-page /> }
  `,
})
export class DocsPage {
  readonly slug = input.required<string>();
  private docs = getDocs();
  protected nav = this.docs.map(({ slug, title, icon, order }) => ({ slug, title, icon, order }));
  protected doc = computed(() => this.docs.find(d => d.slug === this.slug()));
}
