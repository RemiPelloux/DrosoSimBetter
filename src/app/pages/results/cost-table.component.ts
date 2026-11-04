import { Component, input } from '@angular/core';
import { fmtEur, Empty } from '@/components/charts';
import { type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import type { ColorFn } from './results.utils';

const COST_ROWS: [string, (r: StrategyResult, base: StrategyResult) => string][] = [
  ['Filets (amortis)', r => fmtEur(r.costs.net)], ['Produits phyto / bio', r => fmtEur(r.costs.phyto)], ['Main-d’œuvre (pose, passages, prophylaxie)', r => fmtEur(r.costs.labor)],
  ['Parasitoïdes', r => fmtEur(r.costs.bio)], ['TIS', r => fmtEur(r.costs.tis)], ['Coût total', r => fmtEur(r.totalCost)],
  ['CA sauvé vs témoin', (r, b) => fmtEur(r.revenue - b.revenue)], ['Bilan net', (r, b) => fmtEur(r.revenue - b.revenue - r.totalCost)],
  ['Retour sur investissement', (r, b) => (r.totalCost ? `${Math.round(((r.revenue - b.revenue) / r.totalCost) * 100)} %` : '—')],
  ['Heures de travail', r => `${r.laborHours} h`], ['IFT chimique', r => r.ift.toFixed(1)],
];

@Component({
  selector: 'ds-cost-table',
  imports: [Empty],
  host: { style: 'display: contents' },
  templateUrl: './cost-table.component.html',
})
export class CostTable {
  readonly results = input.required<StrategyResult[]>();
  readonly base = input.required<StrategyResult>();
  readonly color = input.required<ColorFn>();
  protected rows = COST_ROWS;
  protected cn = cn;
}
