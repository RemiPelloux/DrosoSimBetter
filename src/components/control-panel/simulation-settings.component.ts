import { Component } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { Calendar, Clock } from 'lucide';
import { gridStore, select } from '@/lib/store';
import { type SimParams } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { IconMildWinter, IconHarshWinter, IconHumidSpring, IconHeat, IconClimate } from '@/components/icons';
import { Field } from './field.component';
import { Segmented } from './segmented.component';

const CLIMATES = [
  { id: 'mild-winter', label: 'Hiver doux', icon: IconMildWinter, desc: 'Survie hivernale élevée, pression précoce' },
  { id: 'harsh-winter', label: 'Hiver rigoureux', icon: IconHarshWinter, desc: 'Mortalité hivernale élevée' },
  { id: 'humid-spring', label: 'Printemps humide', icon: IconHumidSpring, desc: 'Ponte ↑, véraison retardée, traitements lessivés' },
  { id: 'dry-summer', label: 'Été caniculaire', icon: IconHeat, desc: 'Ponte freinée et surmortalité > 28 °C' },
] as const;

// ------------------------------------------------------------------ Réglages de simulation
@Component({
  selector: 'ds-simulation-settings',
  imports: [Field, Segmented, NgComponentOutlet],
  host: { style: 'display: contents' },
  templateUrl: './simulation-settings.component.html',
})
export class SimulationSettings {
  protected I = { Calendar, Clock };
  protected IconClimate = IconClimate;
  protected cn = cn;
  protected climates = CLIMATES;
  protected simParams = select(s => s.simParams);
  protected seasonOpts: { v: SimParams['startSeason']; l: string }[] = [{ v: 'spring', l: 'Printemps' }, { v: 'autumn', l: 'Automne' }];
  protected durationOpts = [{ v: '1', l: '1 an' }, { v: '2', l: '2 ans' }, { v: '3', l: '3 ans' }];
  protected set(p: Partial<SimParams>) { gridStore.getState().setSimParams(p); }
}
