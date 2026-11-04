import { Component, computed, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ChevronDown, Wand2, Lock } from 'lucide';
import { gridStore, select, parcelsSig } from '@/lib/store';
import { defaultLeverConfig, type LeverConfig, type CellType } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { IconForest, IconCherry } from '@/components/icons';
import { Lucide } from '../ui/lucide';
import { Motion } from '../ui/motion';
import { LEVERS, type LeverKey, type Lever } from './control-panel.utils';
import { AdvancedLevers } from './advanced-levers.component';

/** Index précalculés : levier par clé et nombre de leviers applicables par type de case. */
const LEVER_BY_KEY = Object.fromEntries(LEVERS.map(l => [l.key, l])) as Record<LeverKey, Lever>;
const TARGET_COUNT: Partial<Record<CellType, number>> = {};
for (const t of ['forest', 'early-cherry', 'season-cherry', 'late-cherry'] as CellType[]) TARGET_COUNT[t] = LEVERS.filter(l => l.targets(t)).length;

// ------------------------------------------------------------------ Matrice des leviers
@Component({
  selector: 'ds-lever-matrix',
  imports: [Lucide, Motion, NgComponentOutlet, AdvancedLevers, IconForest, IconCherry],
  host: { style: 'display: contents' },
  templateUrl: './lever-matrix.component.html',
})
export class LeverMatrix {
  protected I = { Lock, Wand2, ChevronDown };
  protected cn = cn;
  protected levers = LEVERS;
  protected defaults = defaultLeverConfig;
  protected targetCount = TARGET_COUNT;
  protected store = gridStore.getState();
  protected strategies = select(s => s.strategies);
  protected activeId = select(s => s.activeStrategyId);
  protected selectedParcelId = select(s => s.selectedParcelId);
  protected parcels = parcelsSig;
  protected active = computed(() => this.strategies().find(s => s.id === this.activeId()));
  protected open = signal<string | null>(null);

  protected allOn = computed(() => {
    const a = this.active(), parcels = this.parcels();
    const out = {} as Record<LeverKey, boolean>;
    for (const k of Object.keys(LEVER_BY_KEY) as LeverKey[]) {
      const lever = LEVER_BY_KEY[k];
      out[k] = !!a && parcels.filter(p => lever.targets(p.type)).every(p => a.leversByParcel[p.id]?.[k]);
    }
    return out;
  });

  protected count(lv: LeverConfig) { return LEVERS.filter(l => lv[l.key]).length; }
  protected applyAll(l: Lever, on: boolean) { this.store.applyLeverToAll({ [l.key]: !on } as Partial<LeverConfig>, l.key === 'parasitoids' ? 'all' : 'cherry'); }
  protected toggle(parcelId: string, l: Lever, on: boolean) { this.store.updateLever(parcelId, { [l.key]: !on } as Partial<LeverConfig>); }
}
