import type { Routes } from '@angular/router';
import { getDocs } from '@/lib/docs';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then(m => m.HomePage) },
  {
    path: 'simulator', loadComponent: () => import('./pages/simulator').then(m => m.SimulatorPage),
    title: 'Verger & leviers',
    data: { description: 'Dessinez vos parcelles de cerisiers et d’espaces naturels, puis composez des stratégies de protection levier par levier. La simulation se recalcule à chaque modification.' },
  },
  {
    path: 'results', loadComponent: () => import('./pages/results').then(m => m.ResultsPage),
    title: 'Résultats & comparateur',
    data: { description: 'Verdict, classement des stratégies, dynamique des populations, bilan économique, carte de pression et recommandations : le comparatif complet face au témoin sans protection.' },
  },
  { path: 'docs', pathMatch: 'full', redirectTo: 'docs/presentation' },
  ...getDocs().map(d => ({
    path: `docs/${d.slug}`,
    loadComponent: () => import('./pages/docs').then(m => m.DocsPage),
    title: `${d.title} · Documentation`,
    data: { slug: d.slug, description: `Documentation DrosoSim Next, chapitre ${d.order} : ${d.title}.` },
  })),
  { path: '**', loadComponent: () => import('./pages/not-found').then(m => m.NotFoundPage), title: 'Page introuvable' },
];
