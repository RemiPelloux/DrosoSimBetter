// =============================================================================
// Backends de simulation — DrosoSim Next
// -----------------------------------------------------------------------------
// L'interface est volontairement minimale : un backend reçoit une `SimRequest`
// et renvoie une `SimOutput`. Trois implémentations sont fournies :
//   • local : moteur TypeScript dans un Web Worker (par défaut, hors ligne)
//   • http  : POST JSON vers un serveur (FastAPI, Express, Rust…)
//   • ws    : WebSocket (adapté aux calculs longs côté serveur)
// Sélection : variables NEXT_PUBLIC_SIM_BACKEND / NEXT_PUBLIC_SIM_BACKEND_URL,
// ou à chaud via `?backend=<url>` dans l'adresse (voir docs/09-backend.md).
// =============================================================================
import {
  isCherry, PHENOLOGY, CHERRY_TYPES,
  type CellType, type ParcelInfo, type StrategyInput, type SimParams, type Economics, type SimOutput, type StrategyResult,
} from './engine';

export const CONTRACT_VERSION = 1;

/** Requête envoyée au backend (JSON) */
export interface SimRequest {
  version: number;
  grid: CellType[];              // 400 cases, ligne par ligne (index = y * 20 + x)
  gridSize: number;              // 20
  parcels: ParcelInfo[];         // parcelles détectées : id, nom, type, indices des cases
  strategies: StrategyInput[];   // témoin + stratégies, leviers par parcelle
  params: SimParams;             // saison de départ, durée, profil climatique
  eco: Economics;                // rendement, prix, surface d'une case, coûts
}

export type BackendMode = 'local' | 'http' | 'ws';
export interface BackendConfig { mode: BackendMode; url?: string; }

export interface SimulationBackend {
  readonly mode: BackendMode;
  readonly label: string;
  run(req: SimRequest): Promise<SimOutput>;
}

// ---------------------------------------------------------------- Configuration
const LS_KEY = 'drososim-backend';

export function getBackendConfig(): BackendConfig {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('backend');
    if (q) {
      const cfg: BackendConfig = q === 'local' ? { mode: 'local' } : { mode: q.startsWith('ws') ? 'ws' : 'http', url: q };
      localStorage.setItem(LS_KEY, JSON.stringify(cfg));
      return cfg;
    }
    const saved = localStorage.getItem(LS_KEY);
    if (saved) try { return JSON.parse(saved) as BackendConfig; } catch { /* ignore */ }
  }
  const mode = (process.env.NEXT_PUBLIC_SIM_BACKEND as BackendMode) || 'local';
  return { mode, url: process.env.NEXT_PUBLIC_SIM_BACKEND_URL };
}

export function setBackendConfig(cfg: BackendConfig | null) {
  if (cfg) localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(LS_KEY);
  cached = null;
}

let cached: SimulationBackend | null = null;
export function getBackend(): SimulationBackend {
  if (cached) return cached;
  const cfg = getBackendConfig();
  cached = cfg.mode === 'http' && cfg.url ? new HttpBackend(cfg.url)
    : cfg.mode === 'ws' && cfg.url ? new WsBackend(cfg.url)
    : new LocalBackend();
  return cached;
}
export const localBackend = () => new LocalBackend();

// ---------------------------------------------------------------- Local (Web Worker)
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (o: SimOutput) => void>();

class LocalBackend implements SimulationBackend {
  readonly mode = 'local' as const;
  readonly label = 'Moteur local';
  run(req: SimRequest) {
    if (!worker) {
      worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ id: number; out: SimOutput }>) => { pending.get(e.data.id)?.(e.data.out); pending.delete(e.data.id); };
    }
    const id = ++seq;
    return new Promise<SimOutput>(resolve => {
      pending.set(id, resolve);
      worker!.postMessage({ id, grid: req.grid, parcels: req.parcels, strategies: req.strategies, params: req.params, eco: req.eco });
    });
  }
}

// ---------------------------------------------------------------- HTTP
class HttpBackend implements SimulationBackend {
  readonly mode = 'http' as const;
  readonly label: string;
  constructor(private url: string) { this.label = `Backend HTTP · ${new URL(url).host}`; }
  async run(req: SimRequest) {
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
      return normalizeOutput(await res.json(), req, performance.now() - t0);
    } finally { clearTimeout(timer); }
  }
}

// ---------------------------------------------------------------- WebSocket
class WsBackend implements SimulationBackend {
  readonly mode = 'ws' as const;
  readonly label: string;
  private socket: WebSocket | null = null;
  private ready: Promise<WebSocket> | null = null;
  private waiting = new Map<number, { resolve: (o: SimOutput) => void; reject: (e: Error) => void; req: SimRequest; t0: number }>();
  private n = 0;
  constructor(private url: string) { this.label = `Backend WebSocket · ${new URL(url).host}`; }
  private connect() {
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const s = new WebSocket(this.url);
      s.onopen = () => resolve(s);
      s.onerror = () => reject(new Error(`Connexion WebSocket impossible : ${this.url}`));
      s.onclose = () => { this.waiting.forEach(w => w.reject(new Error('Connexion WebSocket fermée'))); this.waiting.clear(); this.ready = null; };
      s.onmessage = e => {
        const msg = JSON.parse(e.data);
        const w = this.waiting.get(msg.id);
        if (!w) return;
        this.waiting.delete(msg.id);
        if (msg.error) w.reject(new Error(msg.error));
        else w.resolve(normalizeOutput(msg.out ?? msg, w.req, performance.now() - w.t0));
      };
      this.socket = s;
    });
    return this.ready;
  }
  async run(req: SimRequest) {
    const s = await this.connect();
    const id = ++this.n;
    return new Promise<SimOutput>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject, req, t0: performance.now() });
      s.send(JSON.stringify({ type: 'simulate', id, ...req }));
      setTimeout(() => { if (this.waiting.delete(id)) reject(new Error('Délai dépassé (60 s)')); }, 60_000);
    });
  }
}

// ---------------------------------------------------------------- Normalisation
/**
 * Rend la réponse d'un backend compatible avec l'interface, en complétant les
 * champs optionnels. Un backend minimal peut ne renvoyer, par stratégie, que
 * `harvestByParcel` (et idéalement `series`).
 */
export function normalizeOutput(raw: unknown, req: SimRequest, elapsedMs: number): SimOutput {
  const o = raw as Partial<SimOutput> & { results?: Partial<StrategyResult>[] };
  if (!o || !Array.isArray(o.results)) throw new Error('Réponse invalide : champ « results » manquant');
  const NC = req.grid.length;
  const startDoy = o.startDayOfYear ?? (req.params.startSeason === 'spring' ? 59 : 273);
  const totalDays = o.totalDays ?? req.params.durationYears * 365 + (req.params.startSeason === 'autumn' ? 92 : 0);
  const haPerCell = req.eco.cellAreaM2 / 10000;
  const cherry = req.parcels.filter(p => isCherry(p.type));

  const results: StrategyResult[] = o.results.map((r, i) => {
    const s = req.strategies.find(x => x.id === r.id) ?? req.strategies[i];
    const hbp = r.harvestByParcel ?? {};
    const area = cherry.reduce((a, p) => a + p.cells.length, 0);
    const globalHarvest = r.globalHarvest ?? (area ? cherry.reduce((a, p) => a + (hbp[p.id] ?? 100) * p.cells.length, 0) / area : 100);
    const revenue = r.revenue ?? cherry.reduce((a, p) => a + p.cells.length * haPerCell * req.eco.yieldTPerHa * 1000 * req.eco.pricePerKg * ((hbp[p.id] ?? 100) / 100), 0);
    const rc: Partial<StrategyResult['costs']> = r.costs ?? {};
    const costs = { net: rc.net ?? 0, phyto: rc.phyto ?? 0, labor: rc.labor ?? 0, bio: rc.bio ?? 0, tis: rc.tis ?? 0 };
    const peak = r.peakByCell ? Float32Array.from(r.peakByCell as ArrayLike<number>) : new Float32Array(NC);
    return {
      id: r.id ?? s?.id ?? `s${i}`,
      name: r.name ?? s?.name ?? `Stratégie ${i}`,
      isBaseline: r.isBaseline ?? s?.isBaseline ?? i === 0,
      series: r.series ?? [],
      damageSeries: r.damageSeries ?? [],
      harvestByParcel: hbp,
      harvestByParcelYear: r.harvestByParcelYear ?? Object.fromEntries(Object.entries(hbp).map(([k, v]) => [k, [v]])),
      globalHarvest: Math.round(globalHarvest * 10) / 10,
      peakDensity: r.peakDensity ?? Math.round(Math.max(0, ...Array.from(peak))),
      peakByCell: peak,
      ift: r.ift ?? 0,
      costs,
      totalCost: r.totalCost ?? Object.values(costs).reduce((a, b) => a + b, 0),
      revenue: Math.round(revenue),
      laborHours: r.laborHours ?? 0,
      events: r.events ?? [],
    };
  });
  return {
    results,
    computeMs: o.computeMs ?? elapsedMs,
    totalDays, startDayOfYear: startDoy,
    phenology: o.phenology ?? CHERRY_TYPES.filter(t => req.grid.includes(t)).map(t => ({ type: t, start: PHENOLOGY[t].veraison, end: PHENOLOGY[t].harvest })),
  };
}

/** Sérialisation JSON d'une sortie (Float32Array → tableau) — utile côté serveur Node */
export function serializeOutput(out: SimOutput) {
  return { ...out, results: out.results.map(r => ({ ...r, peakByCell: Array.from(r.peakByCell) })) };
}

