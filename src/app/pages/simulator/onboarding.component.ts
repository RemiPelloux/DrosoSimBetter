import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { ArrowRight, Activity, X, Paintbrush, Wand2, BarChart3, type IconNode } from 'lucide';
import { FlyingFlies } from '@/components/illustrations';
import { Lucide } from '@/components/ui/lucide';
import { Motion, motionAnimate } from '@/components/ui/motion';
import { gridStore, select } from '@/lib/store';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------ Visite guidée
const STEPS: { icon: IconNode; title: string; text: string }[] = [
  { icon: Paintbrush, title: 'Dessinez votre verger en 10 secondes', text: 'Choisissez un type (Espace Naturel, Cerise Précoce, Saison, Tardive) puis cliquez-glissez. Outil « Zone » pour un rectangle d’un geste, clic droit pour gommer. Ou partez d’un modèle.' },
  { icon: Wand2, title: 'Activez vos leviers par parcelle', text: 'Filet, prophylaxie, traitements, parasitoïdes, TIS : un clic par parcelle, ou « Appliquer à toutes ». Dépliez une parcelle pour les réglages avancés.' },
  { icon: Activity, title: 'Résultats instantanés', text: 'Chaque modification relance la simulation (quelques ms). Le témoin sans protection est toujours calculé pour comparer.' },
  { icon: BarChart3, title: 'Comparez & exportez', text: 'Créez plusieurs stratégies, comparez-les côte à côte, puis partagez un lien ou imprimez une Fiche Conseil PDF.' },
];

const ICON_SPRING = { type: 'spring', stiffness: 260, damping: 18 };

/** Visite guidée de la première visite (toujours montée ; s'affiche tant que onboardingDone est faux). */
@Component({
  selector: 'ds-onboarding',
  imports: [Lucide, Motion, FlyingFlies],
  host: { style: 'display: contents' },
  templateUrl: './onboarding.component.html',
})
export class Onboarding {
  protected done = select(s => s.onboardingDone);
  protected i = signal(0);
  /** étape affichée : suit `i` après l'animation de sortie (AnimatePresence mode="wait") */
  protected shown = signal(0);
  protected steps = STEPS;
  protected spring = ICON_SPRING;
  protected I = { X, ArrowRight };
  protected cn = cn;
  private card = viewChild<ElementRef<HTMLElement>>('card');
  private iconBox = viewChild<ElementRef<HTMLElement>>('iconBox');
  private textBox = viewChild<ElementRef<HTMLElement>>('textBox');
  private switching = false;

  /** Changement d'étape façon AnimatePresence mode="wait" : sortie de l'étape courante, puis entrée de la suivante. */
  protected async go(k: number) {
    this.i.set(k);
    if (this.switching) return;
    this.switching = true;
    while (this.shown() !== this.i()) {
      const icon = this.iconBox()?.nativeElement, text = this.textBox()?.nativeElement;
      await Promise.all([
        icon ? motionAnimate(icon, { scale: 0.5, opacity: 0 }, ICON_SPRING) : null,
        text ? motionAnimate(text, { opacity: 0, x: -20 }) : null,
      ]);
      this.shown.set(this.i());
    }
    this.switching = false;
  }

  protected next() { if (this.i() < STEPS.length - 1) this.go(this.i() + 1); else this.finish(); }

  protected finish() {
    const { setOnboardingDone, loadTemplate, grid } = gridStore.getState();
    // sortie de la carte (l'arrière-plan s'efface via son animation de sortie)
    const c = this.card()?.nativeElement;
    if (c) motionAnimate(c, { scale: 0.95, opacity: 0 });
    setOnboardingDone(true);
    if (grid.every(x => x === 'neutral')) loadTemplate('mixed');
  }
}
