import { Component, computed, signal } from '@angular/core';
import { ChevronDown } from 'lucide';
import { gridStore, select } from '@/lib/store';
import { defaultCosts, type LeverCosts, type Economics } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { Lucide } from '../ui/lucide';
import { NumberField } from './number-field.component';

// ------------------------------------------------------------------ Réglages économiques
@Component({
  selector: 'ds-economics-settings',
  imports: [Lucide, NumberField],
  host: { style: 'display: contents' },
  templateUrl: './economics-settings.component.html',
})
export class EconomicsSettings {
  protected I = { ChevronDown };
  protected cn = cn;
  protected eco = select(s => s.economics);
  protected open = signal(false);
  protected costs = computed(() => ({ ...defaultCosts, ...(this.eco().costs ?? {}) }));
  protected isDefault = computed(() => { const c = this.costs(); return (Object.keys(defaultCosts) as (keyof LeverCosts)[]).every(k => c[k] === defaultCosts[k]); });
  protected fields: [keyof LeverCosts, string, string, number][] = [
    ['netMonorang', 'Filet monorang', '€/ha/an', 50], ['netMonoparcelle', 'Filet monoparcelle', '€/ha/an', 50], ['laborHour', 'Main-d’œuvre', '€/h', 0.5],
    ['phytoConv', 'Phyto conventionnel', '€/passage/ha', 5], ['phytoBio', 'Biocontrôle', '€/passage/ha', 5], ['tis', 'TIS', '€/ha', 25],
    ['parasitoidStd', 'Parasitoïdes standard', '€/ha', 10], ['parasitoidReinf', 'Parasitoïdes renforcé', '€/ha', 10],
  ];
  protected defaults() { return { ...defaultCosts }; }
  protected set(e: Partial<Economics>) { gridStore.getState().setEconomics(e); }
  protected setCost(k: keyof LeverCosts, v: number) { this.set({ costs: { ...this.costs(), [k]: v } }); }
}
