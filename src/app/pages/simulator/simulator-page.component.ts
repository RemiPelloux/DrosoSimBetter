import { Component, ElementRef, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowRight, Zap, Minimize2, PanelLeft, Columns3, PanelRight, ChevronDown, Euro, Map as MapIcon, SlidersHorizontal, Activity, Paintbrush, type IconNode } from 'lucide';
import { AppHeader, LiveBadge, injectShareHydration } from '@/components/app-header';
import { GridEditor } from '@/components/grid-editor';
import { SimulationSettings, StrategyBar, LeverMatrix, EconomicsSettings } from '@/components/control-panel';
import { PopulationChart, HarvestByParcelChart, fmtEur, THRESHOLD } from '@/components/charts';
import { Drosophila } from '@/components/illustrations';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { gridStore, select } from '@/lib/store';
import { injectSimulation } from '@/lib/simulation';
import { cn } from '@/lib/utils';
import { ResizeHandle } from './resize-handle.component';
import { Panel } from './panel.component';
import { MiniKpi } from './mini-kpi.component';
import { Onboarding } from './onboarding.component';

// ------------------------------------------------------------------ Page
const PRESETS: [string, [number, number], IconNode][] = [['Éditeur large', [52, 25], PanelLeft], ['Équilibrée', [32, 36], Columns3], ['Leviers large', [26, 46], PanelRight]];
const TABS: ['map' | 'levers' | 'live', string, IconNode][] = [['map', 'Verger', MapIcon], ['levers', 'Leviers', SlidersHorizontal], ['live', 'Aperçu', Activity]];

@Component({
  selector: 'ds-simulator-page',
  imports: [
    RouterLink, AppHeader, LiveBadge, GridEditor, SimulationSettings, StrategyBar, LeverMatrix, EconomicsSettings,
    PopulationChart, HarvestByParcelChart, Drosophila, Lucide, Motion, ResizeHandle, Panel, MiniKpi, Onboarding,
  ],
  host: { style: 'display: contents' },
  templateUrl: './simulator-page.component.html',
})
export class SimulatorPage {
  protected I = { ArrowRight, Zap, Minimize2, ChevronDown, Euro, SlidersHorizontal, Activity, Paintbrush };
  protected cn = cn;
  protected fmtEur = fmtEur;
  protected threshold = THRESHOLD;
  protected presets = PRESETS;
  protected tabs = TABS;
  protected bounce = { animate: { y: [0, -6, 0] }, transition: { duration: 2, repeat: 1e9 } };

  protected strategies = select(s => s.strategies);
  protected activeId = select(s => s.activeStrategyId);
  protected layout = select(s => s.layout);
  protected fullscreen = select(s => s.editorFullscreen);
  private economics = select(s => s.economics);
  private main = viewChild.required<ElementRef<HTMLElement>>('main');

  private sim = injectSimulation();
  protected out = this.sim.out;
  protected running = this.sim.running;
  protected parcels = this.sim.parcels;
  protected source = this.sim.source;
  protected showEco = signal(false);
  protected mobileTab = signal<'map' | 'levers' | 'live'>('map');

  protected active = computed(() => this.out()?.results.find(r => r.id === this.activeId()));
  protected activeColor = computed(() => this.strategies().find(s => s.id === this.activeId())?.color ?? null);
  protected base = computed(() => this.out()?.results.find(r => r.isBaseline));
  protected net = computed(() => { const a = this.active(), b = this.base(); return a && b ? a.revenue - b.revenue - a.totalCost : 0; });
  protected harvestDelta = computed(() => { const a = this.active(), b = this.base(); return !a || !b || a.isBaseline ? undefined : a.globalHarvest - b.globalHarvest; });
  protected subtitle = computed(() => {
    const ps = this.parcels();
    const haTotal = ps.reduce((a, p) => a + p.area, 0) * this.economics().cellAreaM2 / 10000;
    return `${ps.length} parcelles · ${haTotal.toFixed(2)} ha · ${this.strategies().length} stratégies`;
  });

  constructor() { injectShareHydration(); }

  protected setLayout(l: [number, number]) { gridStore.getState().setLayout(l); }
  protected isPreset(v: [number, number]) { const l = this.layout(); return Math.abs(l[0] - v[0]) < 1 && Math.abs(l[1] - v[1]) < 1; }
  protected exitFullscreen() { gridStore.getState().setEditorFullscreen(false); }

  protected startDrag(which: 0 | 1, e: PointerEvent) {
    e.preventDefault();
    const rect = this.main().nativeElement.getBoundingClientRect();
    const setLayout = gridStore.getState().setLayout;
    const move = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const [l, c] = gridStore.getState().layout;
      if (which === 0) { const nl = Math.min(54, Math.max(22, pct)); setLayout([nl, Math.max(24, Math.min(c, 100 - nl - 22))]); }
      else setLayout([l, Math.min(100 - l - 22, Math.max(24, pct - l))]);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
}
