import { Component, computed, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { LEVERS } from '@/components/control-panel';
import { type Strategy, type Parcel } from '@/lib/store';
import { type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';

@Component({
  selector: 'ds-lever-table',
  imports: [NgComponentOutlet],
  host: { style: 'display: contents' },
  templateUrl: './lever-table.component.html',
})
export class LeverTable {
  readonly strategies = input.required<Strategy[]>();
  readonly parcels = input.required<Parcel[]>();
  readonly results = input.required<StrategyResult[]>();
  readonly haPerCell = input.required<number>();
  protected cn = cn;
  // index stratégie → résultat : évite un results.find() dans la double boucle parcelles × stratégies
  protected resultById = computed(() => new Map(this.results().map(r => [r.id, r])));
  protected activeLevers(s: Strategy, p: Parcel) {
    const lv = s.leversByParcel[p.id];
    return LEVERS.filter(l => lv?.[l.key] && l.targets(p.type));
  }
}
