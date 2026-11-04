import { Component, computed, input, output } from '@angular/core';
import { type Parcel } from '@/lib/store';
import { isCherry, type LeverConfig } from '@/lib/engine';
import { Adv } from './adv.component';
import { Row } from './row.component';
import { Toggle } from './toggle.component';
import { Segmented } from './segmented.component';
import { LEVERS } from './control-panel.utils';

// ------------------------------------------------------------------ Réglages avancés d'une parcelle
@Component({
  selector: 'ds-advanced-levers',
  imports: [Adv, Row, Toggle, Segmented],
  host: { style: 'display: contents' },
  templateUrl: './advanced-levers.component.html',
})
export class AdvancedLevers {
  readonly parcel = input.required<Parcel>();
  readonly lv = input.required<LeverConfig>();
  readonly leverChange = output<Partial<LeverConfig>>();
  protected levers = LEVERS;
  protected cherry = computed(() => isCherry(this.parcel().type));
  protected activeLevers = computed(() => { const lv = this.lv(), t = this.parcel().type; return LEVERS.filter(l => lv[l.key] && l.targets(t)); });
  protected o = {
    netType: [{ v: 'monorang', l: 'Monorang (95 %)' }, { v: 'monoparcelle', l: 'Monoparcelle (85 %)' }] as { v: LeverConfig['netType']; l: string }[],
    netDeploy: [{ v: 'bloom', l: 'Fin floraison' }, { v: 'veraison', l: 'Véraison' }] as { v: LeverConfig['netDeploy']; l: string }[],
    treatmentMode: [{ v: 'conventional', l: 'Conventionnel' }, { v: 'biocontrol', l: 'Biocontrôle' }] as { v: LeverConfig['treatmentMode']; l: string }[],
    passes: ['1', '2', '3', '4'].map(v => ({ v, l: v })),
    trigger: [{ v: 'calendar', l: 'Calendaire' }, { v: 'threshold', l: 'Seuil piégeage' }] as { v: LeverConfig['treatmentTrigger']; l: string }[],
    season: [{ v: 'spring', l: 'Printemps' }, { v: 'autumn', l: 'Automne' }] as { v: LeverConfig['parasitoidSeason']; l: string }[],
    dose: [{ v: 'standard', l: 'Dose standard' }, { v: 'reinforced', l: 'Dose renforcée' }] as { v: LeverConfig['parasitoidDose']; l: string }[],
  };
}
