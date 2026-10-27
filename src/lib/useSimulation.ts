'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGridStore, useParcels, GRID_N } from './store';
import { detectParcels, type SimOutput } from './engine';
import { getBackend, localBackend, CONTRACT_VERSION, type SimRequest } from './backend';

/**
 * Simulation temps réel : relancée à chaque modification, la dernière requête gagne.
 * Le calcul est délégué au backend configuré (moteur local par défaut, HTTP ou
 * WebSocket — voir src/lib/backend.ts). En cas d'erreur d'un backend distant,
 * on bascule automatiquement sur le moteur local et l'erreur est exposée.
 */
export function useSimulation(opts: { strategyIds?: string[]; durationOverride?: number } = {}) {
  const grid = useGridStore(s => s.grid);
  const strategies = useGridStore(s => s.strategies);
  const simParams = useGridStore(s => s.simParams);
  const economics = useGridStore(s => s.economics);
  const parcels = useParcels();
  const simParcels = useMemo(() => detectParcels(grid), [grid]); // les renommages ne relancent pas le calcul
  const [out, setOut] = useState<SimOutput | null>(null);
  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<{ label: string; error?: string }>({ label: 'Moteur local' });
  const latest = useRef(0);
  const key = opts.strategyIds?.join(',') ?? '*';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const backend = getBackend();
    const delay = backend.mode === 'local' ? 60 : 350; // on regroupe davantage les appels réseau
    const t = setTimeout(async () => {
      const id = ++latest.current;
      setRunning(true);
      const req: SimRequest = {
        version: CONTRACT_VERSION,
        grid, gridSize: GRID_N,
        parcels: simParcels,
        strategies: (opts.strategyIds ? strategies.filter(s => opts.strategyIds!.includes(s.id)) : strategies)
          .map(s => ({ id: s.id, name: s.name, isBaseline: s.isBaseline, leversByParcel: s.leversByParcel })),
        params: opts.durationOverride ? { ...simParams, durationYears: opts.durationOverride } : simParams,
        eco: economics,
      };
      try {
        const o = await backend.run(req);
        if (latest.current !== id) return;
        setOut(o); setSource({ label: backend.label });
      } catch (err) {
        if (backend.mode === 'local') throw err;
        const o = await localBackend().run(req);
        if (latest.current !== id) return;
        setOut(o); setSource({ label: 'Moteur local (secours)', error: `${backend.label} : ${(err as Error).message}` });
      } finally {
        if (latest.current === id) setRunning(false);
      }
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, strategies, simParams, economics, simParcels, key, opts.durationOverride]);

  return { out, running, parcels, source };
}
