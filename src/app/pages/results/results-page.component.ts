import { Component, computed, effect, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrendingUp, Euro, Activity, BarChart3, Layers, Columns3, Map as MapIcon, Info, Printer, Clock, Users, Radar as RadarIcon } from 'lucide';
import { AppHeader, download, toast, injectShareHydration } from '@/components/app-header';
import { PopulationChart, HarvestByParcelChart, OverlayChart, EconomicsChart, RadarScore, HealthyFruitChart, YearlyHarvestChart, StrategyLegend } from '@/components/charts';
import { MiniMap } from '@/components/grid-editor';
import { SimulationSettings, EconomicsSettings } from '@/components/control-panel';
import { BuzzingFly } from '@/components/illustrations';
import { IconClimate, IconHarvest } from '@/components/icons';
import { Chapter } from '@/components/art';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { gridStore, select } from '@/lib/store';
import { injectSimulation } from '@/lib/simulation';
import { dayLabel, isCherry, type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { projectPayload } from '@/lib/projectIO';
import { Card } from './card.component';
import { FocusPicker } from './focus-picker.component';
import { SkeletonResults } from './skeleton-results.component';
import { ChapterNav } from './chapter-nav.component';
import { Hero } from './hero.component';
import { Podium } from './podium.component';
import { StrategyCard } from './strategy-card.component';
import { FinalCta } from './final-cta.component';
import { HeatPanel } from './heat-panel.component';
import { LeverTable } from './lever-table.component';
import { CostTable } from './cost-table.component';
import { Recommendations } from './recommendations.component';
import { Hypotheses } from './hypotheses.component';
import type { Chip } from './results.utils';

// ======================================================================= Page
const CLIMATE_LABEL = { 'mild-winter': 'Hiver doux', 'harsh-winter': 'Hiver rigoureux', 'humid-spring': 'Printemps humide', 'dry-summer': 'Été caniculaire' } as const;

@Component({
  selector: 'ds-results-page',
  imports: [
    RouterLink, Motion, Lucide, AppHeader, BuzzingFly, MiniMap, SimulationSettings, EconomicsSettings, Chapter,
    PopulationChart, HarvestByParcelChart, OverlayChart, EconomicsChart, RadarScore, HealthyFruitChart, YearlyHarvestChart, StrategyLegend,
    Card, FocusPicker, SkeletonResults, ChapterNav, Hero, Podium, StrategyCard, FinalCta, HeatPanel, LeverTable, CostTable, Recommendations, Hypotheses,
  ],
  host: { style: 'display: contents' },
  templateUrl: './results-page.component.html',
})
export class ResultsPage {
  protected I = { Printer, Columns3, Layers, BarChart3, TrendingUp, Activity, Euro, RadarIcon, MapIcon, Users, Info };
  protected IconHarvest = IconHarvest;
  protected cn = cn;
  protected today = new Date().toLocaleDateString('fr-FR');

  protected strategies = select(s => s.strategies);
  protected grid = select(s => s.grid);
  protected simParams = select(s => s.simParams);
  protected economics = select(s => s.economics);
  private sim = injectSimulation();
  protected out = this.sim.out;
  protected running = this.sim.running;
  protected parcels = this.sim.parcels;
  protected source = this.sim.source;
  protected excluded = signal<Record<string, boolean>>({});
  protected mode = signal<'columns' | 'overlay'>('columns');
  protected focusId = signal<string | null>(null);
  protected showSettings = signal(false);

  protected shown = computed(() => {
    const out = this.out(), ex = this.excluded();
    if (!out) return null;
    return { ...out, results: out.results.filter(r => r.isBaseline || !ex[r.id]) };
  });
  protected base = computed(() => this.out()?.results.find(r => r.isBaseline));
  protected ranked = computed(() => {
    const base = this.base();
    return (this.shown()?.results ?? []).filter(r => !r.isBaseline).map(r => ({ r, net: r.revenue - (base?.revenue ?? 0) - r.totalCost })).sort((a, b) => b.net - a.net);
  });
  protected best = computed(() => this.ranked().at(0));
  protected focus = computed(() => { const sh = this.shown(); return sh?.results.find(r => r.id === (this.focusId() ?? this.best()?.r.id)) ?? sh?.results[0]; });
  // Map : pas de find() par carte, barre ou colonne
  private colors = computed(() => new Map(this.strategies().map(s => [s.id, s.color])));
  protected color = (id: string) => this.colors().get(id) ?? '#64748B';
  protected haPerCell = computed(() => this.economics().cellAreaM2 / 10000);
  protected cherryHa = computed(() => this.parcels().filter(p => isCherry(p.type)).reduce((a, p) => a + p.area, 0) * this.haPerCell());
  protected climateLabel = computed(() => CLIMATE_LABEL[this.simParams().climateProfile]);
  protected shownStrategies = computed(() => { const sh = this.shown(); return this.strategies().filter(s => sh?.results.some(r => r.id === s.id)); });
  protected nonBaseline = computed(() => this.shown()?.results.filter(r => !r.isBaseline) ?? []);
  protected chips = computed<Chip[]>(() => {
    const ps = this.parcels(), sp = this.simParams(), eco = this.economics(), out = this.out(), cl = this.climateLabel();
    return [
      { icon: MapIcon, label: `${ps.length} parcelles · ${this.cherryHa().toFixed(2)} ha de cerisiers` },
      { icon: Clock, label: `${sp.durationYears} an${sp.durationYears > 1 ? 's' : ''} · départ ${sp.startSeason === 'spring' ? 'printemps' : 'automne'}` },
      { icon: IconClimate, label: out?.climate ? `${cl} · ${Math.round(out.climate.tMin)} → ${Math.round(out.climate.tMax)} °C · ${out.climate.degreeDays.toLocaleString('fr-FR')} DJ` : cl },
      { icon: Euro, label: `${eco.yieldTPerHa} t/ha · ${eco.pricePerKg.toFixed(2)} €/kg` },
    ];
  });

  constructor() {
    injectShareHydration();
    // impression automatique (?print=1)
    effect(() => {
      if (!this.out()) return;
      const p = new URLSearchParams(window.location.search);
      if (p.get('print') === '1') {
        p.delete('print');
        window.history.replaceState(window.history.state, '', window.location.pathname);
        setTimeout(() => window.print(), 600);
      }
    });
  }

  protected modeBtn(active: boolean) {
    return cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all', active ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900');
  }
  protected toggleExcluded(id: string) { this.excluded.update(e => ({ ...e, [id]: !e[id] })); }
  protected loadDemo() { gridStore.getState().loadDemo(); }
  protected print() { window.print(); }

  protected exportCsv() {
    const out = this.out();
    if (!out) return;
    const parcels = this.parcels(), base = this.base();
    const head = ['jour', 'date', 'annee'];
    const cols: [StrategyResult, string, string][] = [];
    out.results.forEach(r => {
      parcels.forEach(p => { head.push(`${r.name} | ${p.name} (femelles/ha)`); cols.push([r, p.id, 'pop']); });
      parcels.filter(p => isCherry(p.type)).forEach(p => { head.push(`${r.name} | ${p.name} (% fruits sains)`); cols.push([r, p.id, 'dmg']); });
    });
    const rows = [head.join(';')];
    out.results[0].series.forEach((pt, i) => {
      const l = dayLabel(pt.day, out.startDayOfYear);
      rows.push([pt.day, l.label, l.year, ...cols.map(([r, pid, k]) => (k === 'pop' ? r.series[i]?.[pid] : r.damageSeries[i]?.[pid]) ?? '')].join(';'));
    });
    rows.push('', 'SYNTHESE;strategie;recolte_%;pic_femelles_ha;IFT;cout_eur;CA_eur;bilan_vs_temoin_eur;main_oeuvre_h');
    out.results.forEach(r => rows.push(['', r.name, r.globalHarvest, r.peakDensity, r.ift, r.totalCost, r.revenue, r.revenue - (base?.revenue ?? 0) - r.totalCost, r.laborHours].join(';')));
    rows.push('', `DROSOSIM-PROJECT;${projectPayload()}`);
    download(`drososim-series-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
    toast('Séries temporelles exportées (.csv)');
  }
}
