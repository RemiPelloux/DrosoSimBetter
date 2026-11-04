import { Component } from '@angular/core';
import { Motion } from '../ui/motion';
import { uid } from './illustrations.utils';

const DAILY_STEPS = [
  { t: '1. Climat', d: 'tables : T(j), ponte, développement, froid, chaleur', c: '#DBEAFE' },
  { t: '2. Traitements', d: 'déclenchement calendaire / seuil, DAR', c: '#FEF3C7' },
  { t: '3. Ressource & capacité', d: 'fruits, résidus, K du jour, filets actifs', c: '#FCE7F3' },
  { t: '4. Dynamique locale', d: 'ponte → dégâts → S₁ S₂ S₃ → émergence → mortalité', c: '#DCFCE7' },
  { t: '5. Dispersion', d: '8 voisines, pondérée, filets symétriques', c: '#EDE9FE' },
  { t: '6. Bilan du jour', d: 'récolte, pics, séries (tous les 3 j)', c: '#F1F5F9' },
].map((s, i) => ({ ...s, x: 10 + (i % 3) * 240, y: i < 3 ? 20 : 130 }));

/** Déroulé d'un pas de temps journalier */
@Component({
  selector: 'ds-daily-step-diagram',
  imports: [Motion],
  host: { style: 'display: contents' },
  templateUrl: './daily-step-diagram.component.html',
})
export class DailyStepDiagram {
  protected id = uid();
  protected url = `url(#${this.id})`;
  protected steps = DAILY_STEPS;
}
