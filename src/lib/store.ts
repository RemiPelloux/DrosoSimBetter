import { create, useStore } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useMemo } from 'react';
import LZString from 'lz-string';
import {
  defaultLeverConfig, defaultCosts, detectParcels, isCherry,
  type CellType, type LeverConfig, type SimParams, type Economics, type ParcelInfo,
} from './engine';

export type { CellType, LeverConfig, SimParams, Economics };
export type Tool = 'brush' | 'rectangle' | 'fill' | 'eraser' | 'select';

export interface Strategy {
  id: string;
  name: string;
  isBaseline: boolean;
  color: string;
  leversByParcel: Record<string, LeverConfig>;
}

export interface Parcel extends ParcelInfo { area: number; color: string; }

export const STRATEGY_COLORS = ['#64748B', '#2563EB', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#DB2777'];
export const GRID_N = 20;
const NC = GRID_N * GRID_N;

interface Persisted {
  grid: CellType[];
  parcelNames: Record<string, string>;
  strategies: Strategy[];
  activeStrategyId: string;
  simParams: SimParams;
  economics: Economics;
}

export interface GridState extends Persisted {
  activeTool: Tool;
  activeCellType: CellType;
  selectedParcelId: string | null;
  onboardingDone: boolean;
  layout: [number, number];          // largeur colonne gauche / centrale (%)
  brushSize: 1 | 2 | 3;
  editorFullscreen: boolean;

  setLayout: (l: [number, number]) => void;
  setBrushSize: (n: 1 | 2 | 3) => void;
  setEditorFullscreen: (v: boolean) => void;
  paint: (indices: number[], type: CellType) => void;
  setGrid: (grid: CellType[]) => void;
  setActiveTool: (t: Tool) => void;
  setActiveCellType: (t: CellType) => void;
  selectParcel: (id: string | null) => void;
  renameParcel: (id: string, name: string) => void;

  addStrategy: (name?: string) => void;
  duplicateStrategy: (id: string) => void;
  renameStrategy: (id: string, name: string) => void;
  removeStrategy: (id: string) => void;
  setActiveStrategy: (id: string) => void;
  updateLever: (parcelId: string, patch: Partial<LeverConfig>, strategyId?: string) => void;
  applyLeverToAll: (patch: Partial<LeverConfig>, scope: 'cherry' | 'forest' | 'all') => void;

  setSimParams: (p: Partial<SimParams>) => void;
  setEconomics: (e: Partial<Economics>) => void;
  loadTemplate: (t: TemplateId) => void;
  loadDemo: () => void;
  setOnboardingDone: (v: boolean) => void;

  saveProject: () => string;
  loadProject: (json: string) => boolean;
  resetProject: () => void;
  toShareString: () => string;
  fromShareString: (s: string) => boolean;
}

export type TemplateId = 'mixed' | 'enclosed' | 'plain' | 'blank';

const baseline = (): Strategy => ({ id: 'baseline', name: 'Témoin sans protection', isBaseline: true, color: STRATEGY_COLORS[0], leversByParcel: {} });

const initial: Persisted = {
  grid: Array(NC).fill('neutral'),
  parcelNames: {},
  strategies: [baseline(), { id: 'strategy-a', name: 'Stratégie A', isBaseline: false, color: STRATEGY_COLORS[1], leversByParcel: {} }],
  activeStrategyId: 'strategy-a',
  simParams: { startSeason: 'spring', durationYears: 1, climateProfile: 'mild-winter' },
  economics: { yieldTPerHa: 10, pricePerKg: 3.5, cellAreaM2: 100, costs: { ...defaultCosts } },
};

export function buildTemplate(t: TemplateId): CellType[] {
  const g: CellType[] = Array(NC).fill('neutral');
  const rect = (x0: number, y0: number, x1: number, y1: number, type: CellType) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * GRID_N + x] = type;
  };
  if (t === 'mixed') {
    rect(0, 0, 19, 2, 'forest');
    rect(2, 5, 8, 12, 'early-cherry');
    rect(11, 5, 17, 12, 'late-cherry');
    rect(2, 15, 17, 17, 'season-cherry');
  } else if (t === 'enclosed') {
    for (let i = 0; i < NC; i++) { const x = i % GRID_N, y = (i / GRID_N) | 0; if (x < 2 || x > 17 || y < 2 || y > 17) g[i] = 'forest'; }
    rect(4, 4, 9, 15, 'early-cherry');
    rect(11, 4, 15, 9, 'season-cherry');
    rect(11, 11, 15, 15, 'late-cherry');
  } else if (t === 'plain') {
    rect(1, 1, 9, 9, 'early-cherry');
    rect(11, 1, 18, 9, 'season-cherry');
    rect(1, 11, 18, 18, 'late-cherry');
  }
  return g;
}

const uid = () => `strategy-${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------- Encodage grille (RLE)
const CODE: Record<CellType, string> = { neutral: 'n', forest: 'f', 'early-cherry': 'e', 'late-cherry': 'l', 'season-cherry': 's' };
const DECODE: Record<string, CellType> = { n: 'neutral', f: 'forest', e: 'early-cherry', l: 'late-cherry', s: 'season-cherry' };
function rle(g: CellType[]) {
  let out = '', i = 0;
  while (i < g.length) { let j = i; while (j < g.length && g[j] === g[i]) j++; out += (j - i) + CODE[g[i]]; i = j; }
  return out;
}
function unrle(s: string): CellType[] | null {
  const g: CellType[] = [];
  for (const m of s.matchAll(/(\d+)([nfels])/g)) for (let k = 0; k < +m[1]; k++) g.push(DECODE[m[2]]);
  return g.length === NC ? g : null;
}

function sanitizeLevers(l: Partial<LeverConfig>): LeverConfig { return { ...defaultLeverConfig, ...l }; }

export const useGridStore = create<GridState>()(
  persist(
    temporal(
      (set, get) => ({
        ...initial,
        activeTool: 'brush',
        activeCellType: 'early-cherry',
        selectedParcelId: null,
        onboardingDone: false,
        layout: [32, 36],
        brushSize: 1,
        editorFullscreen: false,
        setLayout: (layout) => set({ layout }),
        setBrushSize: (brushSize) => set({ brushSize }),
        setEditorFullscreen: (editorFullscreen) => set({ editorFullscreen }),

        paint: (indices, type) => {
          const grid = get().grid.slice();
          let changed = false;
          for (const i of indices) if (i >= 0 && i < NC && grid[i] !== type) { grid[i] = type; changed = true; }
          if (changed) set({ grid });
        },
        setGrid: (grid) => set({ grid: grid.slice(0, NC) }),
        setActiveTool: (activeTool) => set({ activeTool }),
        setActiveCellType: (activeCellType) => set({ activeCellType, activeTool: get().activeTool === 'eraser' || get().activeTool === 'select' ? 'brush' : get().activeTool }),
        selectParcel: (selectedParcelId) => set({ selectedParcelId }),
        renameParcel: (id, name) => set({ parcelNames: { ...get().parcelNames, [id]: name } }),

        addStrategy: (name) => {
          const s = get().strategies;
          const id = uid();
          const color = STRATEGY_COLORS[s.length % STRATEGY_COLORS.length];
          set({ strategies: [...s, { id, name: name ?? `Stratégie ${String.fromCharCode(64 + s.length)}`, isBaseline: false, color, leversByParcel: {} }], activeStrategyId: id });
        },
        duplicateStrategy: (id) => {
          const s = get().strategies;
          const src = s.find(x => x.id === id);
          if (!src) return;
          const nid = uid();
          const copy: Strategy = { ...structuredClone(src), id: nid, isBaseline: false, name: `${src.isBaseline ? 'Nouvelle stratégie' : src.name} (copie)`, color: STRATEGY_COLORS[s.length % STRATEGY_COLORS.length] };
          set({ strategies: [...s, copy], activeStrategyId: nid });
        },
        renameStrategy: (id, name) => set({ strategies: get().strategies.map(s => (s.id === id ? { ...s, name } : s)) }),
        removeStrategy: (id) => {
          if (id === 'baseline') return;
          const strategies = get().strategies.filter(s => s.id !== id);
          set({ strategies, activeStrategyId: get().activeStrategyId === id ? strategies[strategies.length - 1].id : get().activeStrategyId });
        },
        setActiveStrategy: (activeStrategyId) => set({ activeStrategyId }),
        updateLever: (parcelId, patch, strategyId) => {
          const sid = strategyId ?? get().activeStrategyId;
          set({
            strategies: get().strategies.map(s => {
              if (s.id !== sid || s.isBaseline) return s;
              const cur = s.leversByParcel[parcelId] ?? defaultLeverConfig;
              return { ...s, leversByParcel: { ...s.leversByParcel, [parcelId]: { ...cur, ...patch } } };
            }),
          });
        },
        applyLeverToAll: (patch, scope) => {
          const parcels = detectParcels(get().grid);
          const sid = get().activeStrategyId;
          set({
            strategies: get().strategies.map(s => {
              if (s.id !== sid || s.isBaseline) return s;
              const lb = { ...s.leversByParcel };
              for (const p of parcels) {
                const ok = scope === 'all' || (scope === 'cherry' ? isCherry(p.type) : p.type === 'forest');
                if (ok) lb[p.id] = { ...(lb[p.id] ?? defaultLeverConfig), ...patch };
              }
              return { ...s, leversByParcel: lb };
            }),
          });
        },

        setSimParams: (p) => set({ simParams: { ...get().simParams, ...p } }),
        setEconomics: (e) => set({ economics: { ...get().economics, ...e } }),
        loadTemplate: (t) => set({ grid: buildTemplate(t), parcelNames: {} }),
        loadDemo: () => {
          const grid = buildTemplate('mixed');
          const parcels = detectParcels(grid);
          const cherry = parcels.filter(p => isCherry(p.type));
          const forest = parcels.filter(p => p.type === 'forest');
          const lv = (o: Partial<LeverConfig>) => ({ ...defaultLeverConfig, ...o });
          const conv: Record<string, LeverConfig> = {};
          cherry.forEach(p => (conv[p.id] = lv({ treatment: true, treatmentPasses: 3 })));
          const pbi: Record<string, LeverConfig> = {};
          cherry.forEach(p => (pbi[p.id] = lv({ prophylaxis: true, netting: p.type === 'late-cherry' })));
          forest.forEach(p => (pbi[p.id] = lv({ parasitoids: true })));
          const tis: Record<string, LeverConfig> = {};
          cherry.forEach(p => (tis[p.id] = lv({ tis: true, treatment: true, treatmentMode: 'biocontrol', treatmentPasses: 2 })));
          set({
            grid,
            parcelNames: { 'early-cherry-1': 'Bas – Burlat', 'late-cherry-1': 'Haut – Regina', 'season-cherry-1': 'Allée – Summit', 'forest-1': 'Bois du Nord' },
            strategies: [
              baseline(),
              { id: 'demo-conv', name: 'Conventionnelle (chimie seule)', isBaseline: false, color: STRATEGY_COLORS[1], leversByParcel: conv },
              { id: 'demo-pbi', name: 'Protection intégrée', isBaseline: false, color: STRATEGY_COLORS[2], leversByParcel: pbi },
              { id: 'demo-tis', name: 'TIS + biocontrôle', isBaseline: false, color: STRATEGY_COLORS[3], leversByParcel: tis },
            ],
            activeStrategyId: 'demo-pbi',
            simParams: { startSeason: 'spring', durationYears: 2, climateProfile: 'mild-winter' },
          });
        },
        setOnboardingDone: (onboardingDone) => set({ onboardingDone }),

        saveProject: () => {
          const s = get();
          return JSON.stringify({ app: 'drososim-next', version: 2, savedAt: new Date().toISOString(), grid: s.grid, parcelNames: s.parcelNames, strategies: s.strategies, activeStrategyId: s.activeStrategyId, simParams: s.simParams, economics: s.economics }, null, 2);
        },
        loadProject: (json) => {
          try {
            const p = JSON.parse(json);
            if (!Array.isArray(p.grid) || p.grid.length !== NC) return false;
            const strategies: Strategy[] = (p.strategies ?? [baseline()]).map((s: Strategy, i: number) => ({
              ...s, color: s.color ?? STRATEGY_COLORS[i % STRATEGY_COLORS.length],
              leversByParcel: Object.fromEntries(Object.entries(s.leversByParcel ?? {}).map(([k, v]) => [k, sanitizeLevers(v as Partial<LeverConfig>)])),
            }));
            if (!strategies.some(s => s.isBaseline)) strategies.unshift(baseline());
            set({
              grid: p.grid, parcelNames: p.parcelNames ?? {}, strategies,
              activeStrategyId: p.activeStrategyId ?? strategies[strategies.length - 1].id,
              simParams: { ...initial.simParams, ...p.simParams }, economics: { ...initial.economics, ...p.economics, costs: { ...defaultCosts, ...(p.economics?.costs ?? {}) } },
            });
            return true;
          } catch { return false; }
        },
        resetProject: () => set({ ...structuredClone(initial) }),
        toShareString: () => {
          const s = get();
          const payload = { g: rle(s.grid), n: s.parcelNames, s: s.strategies, a: s.activeStrategyId, p: s.simParams, e: s.economics };
          return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
        },
        fromShareString: (str) => {
          try {
            const raw = LZString.decompressFromEncodedURIComponent(str);
            if (!raw) return false;
            const d = JSON.parse(raw);
            const grid = unrle(d.g);
            if (!grid) return false;
            return get().loadProject(JSON.stringify({ grid, parcelNames: d.n, strategies: d.s, activeStrategyId: d.a, simParams: d.p, economics: d.e }));
          } catch { return false; }
        },
      }),
      {
        limit: 50,
        partialize: (s): Persisted => ({ grid: s.grid, parcelNames: s.parcelNames, strategies: s.strategies, activeStrategyId: s.activeStrategyId, simParams: s.simParams, economics: s.economics }),
        equality: (a, b) => a.grid === b.grid && a.parcelNames === b.parcelNames && a.strategies === b.strategies && a.simParams === b.simParams && a.economics === b.economics,
      },
    ),
    {
      name: 'drososim-next-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ grid: s.grid, parcelNames: s.parcelNames, strategies: s.strategies, activeStrategyId: s.activeStrategyId, simParams: s.simParams, economics: s.economics, onboardingDone: s.onboardingDone, layout: s.layout, brushSize: s.brushSize }),
    },
  ),
);

// ---------------------------------------------------------------- Hooks dérivés
const PCOLOR: Record<CellType, string> = { neutral: '#F1F5F9', forest: '#15803D', 'early-cherry': '#D97706', 'late-cherry': '#991B1B', 'season-cherry': '#E11D48' };

export function useParcels(): Parcel[] {
  const grid = useGridStore(s => s.grid);
  const names = useGridStore(s => s.parcelNames);
  return useMemo(() => detectParcels(grid).map(p => ({ ...p, name: names[p.id] || p.name, area: p.cells.length, color: PCOLOR[p.type] })), [grid, names]);
}

export function useHistory() {
  const past = useStore(useGridStore.temporal, s => s.pastStates.length);
  const future = useStore(useGridStore.temporal, s => s.futureStates.length);
  const { undo, redo } = useGridStore.temporal.getState();
  return { canUndo: past > 0, canRedo: future > 0, undo: () => undo(), redo: () => redo(), past };
}
