import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { scroll } from 'framer-motion/dom';
import { ArrowRight, PlayCircle, Paintbrush, SlidersHorizontal, BarChart3, Share2, Tractor, Users, FlaskConical, Check, X, Sparkles, MousePointerClick, Timer, Leaf, BookOpen, Zap } from 'lucide';
import { gridStore, select } from '@/lib/store';
import { simulate, detectParcels, defaultLeverConfig, isCherry, type LeverConfig } from '@/lib/engine';
import { Logo, FlyingFlies, Drosophila, CherryArt, LifeCycleDiagram } from '@/components/illustrations';
import { CountUp, Grain, Contours, IsoOrchard, HillsBackdrop } from '@/components/art';
import { IconNet, IconFly } from '@/components/icons';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { DEMO_GRID, EASE_OUT_EXPO, type Run } from './home.utils';
import { SectionTitle } from './section-title.component';
import { StepCard } from './step-card.component';
import { PaintArt } from './paint-art.component';
import { LeverArt } from './lever-art.component';
import { DecideArt } from './decide-art.component';
import { VerdictPreview } from './verdict-preview.component';
import { HeroOrchard } from './hero-orchard.component';

function demoRun() {
  const parcels = detectParcels(DEMO_GRID);
  const lv = (o: Partial<LeverConfig>) => ({ ...defaultLeverConfig, ...o });
  const pbi: Record<string, LeverConfig> = {};
  parcels.forEach(p => {
    if (isCherry(p.type)) pbi[p.id] = lv({ prophylaxis: true, netting: p.type === 'late-cherry', tis: p.type !== 'late-cherry' });
    else pbi[p.id] = lv({ parasitoids: true });
  });
  const out = simulate(DEMO_GRID, parcels, [
    { id: 'base', name: 'Sans protection', isBaseline: true, leversByParcel: {} },
    { id: 'pbi', name: 'Protection intégrée', isBaseline: false, leversByParcel: pbi },
  ], { startSeason: 'spring', durationYears: 2, climateProfile: 'mild-winter' }, { yieldTPerHa: 10, pricePerKg: 3.5, cellAreaM2: 100 } as Parameters<typeof simulate>[4]);
  const [base, pbiR] = out.results;
  return { base, pbi: pbiR, max: Math.max(...Array.from(base.peakByCell), 1), ms: out.computeMs };
}

// ======================================================================= Partenaires
const PARTNERS = [
  { name: 'République Française', desc: 'République Française', logo: '/partners/republique-francaise.png', link: 'https://www.info.gouv.fr/', w: 392, h: 342 },
  { name: 'INRAE', desc: "Institut national de recherche pour l'agriculture, l'alimentation et l'environnement — équipe M2P2, Sophia Antipolis", logo: '/partners/INRAE.png', link: 'https://inrae.fr', w: 300, h: 79 },
  { name: 'CTIFL', desc: 'Centre Technique Interprofessionnel des Fruits et Légumes', logo: '/partners/CTIFL.png', link: 'https://ctifl.fr', w: 470, h: 590 },
  { name: "Univ Côte d'Azur", desc: "Université Côte d'Azur", logo: '/partners/univ-cote-azur.png', link: 'https://univ-cotedazur.fr/', w: 400, h: 340 },
  { name: 'Ecophyto', desc: 'Plan Écophyto', logo: '/partners/Ecophyto.png', link: 'https://agriculture.gouv.fr/le-plan-ecophyto-quest-ce-que-cest', w: 960, h: 422 },
  { name: 'OFB', desc: 'Office Français de la Biodiversité', logo: '/partners/OFB.png', link: 'https://ofb.gouv.fr/', w: 464, h: 615 },
];

// ======================================================================= Page
@Component({
  selector: 'ds-home-page',
  imports: [
    RouterLink, Motion, Lucide, Logo, FlyingFlies, Drosophila, CherryArt, LifeCycleDiagram,
    CountUp, Grain, Contours, IsoOrchard, HillsBackdrop, IconNet, IconFly,
    SectionTitle, StepCard, PaintArt, LeverArt, DecideArt, VerdictPreview, HeroOrchard,
  ],
  host: { style: 'display: contents' },
  templateUrl: './home-page.component.html',
})
export class HomePage {
  private router = inject(Router);
  protected cn = cn;
  protected ease = EASE_OUT_EXPO;
  protected inf = Infinity;
  protected grid = DEMO_GRID;
  protected run: Run = demoRun();
  protected hasProject = select(s => s.grid.some(c => c !== 'neutral'));
  protected partners = PARTNERS;
  protected I = { ArrowRight, PlayCircle, Paintbrush, SlidersHorizontal, BarChart3, Share2, Check, X, Sparkles, MousePointerClick, Timer, Leaf, BookOpen, Zap };
  protected navLinks = [['#fonctionnement', 'Fonctionnement'], ['#modele', 'Le modèle'], ['#pourquoi', 'Pourquoi']];
  protected kpis = [
    { v: 400, s: '', l: 'cases simulées chaque jour', d: 0, plus: false },
    { v: this.run.ms, s: ' ms', l: 'pour 2 stratégies sur 2 ans', d: 0, plus: false },
    { v: 5, s: '', l: 'leviers combinables', d: 0, plus: false },
    { v: this.run.pbi.globalHarvest - this.run.base.globalHarvest, s: ' pts', l: 'de récolte sauvée (démo)', d: 0, plus: true },
  ];
  protected bullets = ['Récolte préservée et gain en points vs témoin', 'Bilan net en euros, coûts éditables, ROI', 'Pic de pression, IFT chimique, heures de travail', 'Périodes de maturité et interventions sur les courbes'];
  protected personas = [
    { i: Tractor, t: 'Arboriculteur', q: '« Le filet sur ma tardive est-il rentable face au bois voisin ? »', d: 'Sur PC au bureau ou sur tablette au verger, lisible en plein soleil.' },
    { i: Users, t: 'Conseiller technique', q: '« Je compare trois scénarios en direct devant le producteur. »', d: 'Puis j’envoie un lien ou une Fiche Conseil PDF en un clic.' },
    { i: FlaskConical, t: 'Expérimentateur', q: '« Je veux voir les hypothèses et exporter les séries. »', d: 'Réglages fins, documentation complète, CSV et JSON.' },
  ];
  protected compare = [
    ['Saisie du verger', 'Glisser-déposer case par case', 'Pinceau, zone, remplissage, modèles'],
    ['Correction', 'Impossible, pas d’historique', 'Menu d’édition, gomme clic droit, Ctrl+Z'],
    ['Parcours', '3 écrans séparés', 'Cockpit unifié + aperçu temps réel'],
    ['Calcul', '≈ 0,7 s côté serveur', 'Quelques ms dans le navigateur'],
    ['Graphiques', 'Couleurs sans légende', 'Légendes, phénologie, interventions'],
    ['Décision', 'Aucun indicateur économique', 'Bilan net, ROI, IFT, radar multicritère'],
    ['Partage', 'Icônes mystérieuses', 'Lien, JSON, CSV, Fiche Conseil PDF'],
  ];
  private hero = viewChild.required<ElementRef<HTMLElement>>('hero');

  constructor() {
    // Parallaxe du hero : y 0 → 120 px sur 600 px de défilement, opacité 1 → 0,2 sur 500 px (useScroll + useTransform)
    let stop: VoidFunction | undefined;
    afterNextRender(() => {
      const el = this.hero().nativeElement;
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      stop = scroll((_: number, info: { y: { current: number } }) => {
        const y = info.y.current;
        const ty = 120 * clamp(y / 600);
        el.style.transform = ty ? `translateY(${ty}px)` : 'none';
        el.style.opacity = String(1 - 0.8 * clamp(y / 500));
      });
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }

  protected demo() { gridStore.getState().loadDemo(); gridStore.getState().setOnboardingDone(true); this.router.navigateByUrl('/results'); }
  protected start() { this.router.navigateByUrl('/simulator'); }

  /** Ancres internes (#…) : défilement doux sur la page, sans passer par le routeur (base href). */
  protected anchor(e: Event, hash: string) {
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(history.state, '', hash);
  }
}
