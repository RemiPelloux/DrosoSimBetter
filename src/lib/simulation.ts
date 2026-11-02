import { computed, effect, signal, untracked, type Signal } from '@angular/core';
import { select, parcelsSig, GRID_N, type Parcel } from './store';
import { detectParcels, type SimOutput } from './engine';
import { getBackend, localBackend, CONTRACT_VERSION, type SimRequest } from './backend';

export interface SimSource { label: string; error?: string }
export interface Simulation { out: Signal<SimOutput | null>; running: Signal<boolean>; parcels: Signal<Parcel[]>; source: Signal<SimSource> }

/**
 * Simulation temps réel : relancée à chaque modification, la dernière requête gagne.
 * Le calcul est délégué au backend configuré (moteur local par défaut, HTTP ou
 * WebSocket — voir src/lib/backend.ts). En cas d'erreur d'un backend distant,
 * on bascule automatiquement sur le moteur local et l'erreur est exposée.
 * À appeler dans un contexte d'injection (constructeur ou initialiseur de champ d'un composant).
 */
export function injectSimulation(opts: { strategyIds?: () => string[] | undefined; durationOverride?: () => number | undefined } = {}): Simulation {
  const grid = select(s => s.grid);
  const strategies = select(s => s.strategies);
  const simParams = select(s => s.simParams);
  const economics = select(s => s.economics);
  const simParcels = computed(() => detectParcels(grid())); // les renommages ne relancent pas le calcul
  const out = signal<SimOutput | null>(null);
  const running = signal(false);
  const source = signal<SimSource>({ label: 'Moteur local' });
  let latest = 0;

  effect(onCleanup => {
    const ids = opts.strategyIds?.();
    const duration = opts.durationOverride?.();
    const g = grid(), st = strategies(), sp = simParams(), eco = economics(), parcels = simParcels();
    untracked(() => {
      const backend = getBackend();
      const delay = backend.mode === 'local' ? 60 : 350; // on regroupe davantage les appels réseau
      const t = setTimeout(async () => {
        const id = ++latest;
        running.set(true);
        const req: SimRequest = {
          version: CONTRACT_VERSION,
          grid: g, gridSize: GRID_N,
          parcels,
          strategies: (ids ? st.filter(s => ids.includes(s.id)) : st)
            .map(s => ({ id: s.id, name: s.name, isBaseline: s.isBaseline, leversByParcel: s.leversByParcel })),
          params: duration ? { ...sp, durationYears: duration } : sp,
          eco,
        };
        try {
          const o = await backend.run(req);
          if (latest !== id) return;
          out.set(o); source.set({ label: backend.label });
        } catch (err) {
          if (backend.mode === 'local') throw err;
          const o = await localBackend().run(req);
          if (latest !== id) return;
          out.set(o); source.set({ label: 'Moteur local (secours)', error: `${backend.label} : ${(err as Error).message}` });
        } finally {
          if (latest === id) running.set(false);
        }
      }, delay);
      onCleanup(() => clearTimeout(t));
    });
  });

  return { out: out.asReadonly(), running: running.asReadonly(), parcels: parcelsSig, source: source.asReadonly() };
}
