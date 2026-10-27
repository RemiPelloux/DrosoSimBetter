'use client';
import { useEffect, useRef, useState } from 'react';
import { useMemo } from 'react';
import { useGridStore, useParcels } from './store';
import { detectParcels } from './engine';
import type { SimOutput } from './engine';

let worker: Worker | null = null;
let seq = 0;
const listeners = new Map<number, (o: SimOutput) => void>();
function getWorker() {
  if (!worker && typeof window !== 'undefined') {
    worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; out: SimOutput }>) => {
      const cb = listeners.get(e.data.id);
      if (cb) { listeners.delete(e.data.id); cb(e.data.out); }
    };
  }
  return worker;
}

/** Simulation temps réel : relancée à chaque modification (debounce 60 ms), la dernière requête gagne. */
export function useSimulation(opts: { strategyIds?: string[]; durationOverride?: number } = {}) {
  const grid = useGridStore(s => s.grid);
  const strategies = useGridStore(s => s.strategies);
  const simParams = useGridStore(s => s.simParams);
  const economics = useGridStore(s => s.economics);
  const parcels = useParcels();
  const simParcels = useMemo(() => detectParcels(grid), [grid]); // les renommages ne relancent pas le calcul
  const [out, setOut] = useState<SimOutput | null>(null);
  const [running, setRunning] = useState(false);
  const latest = useRef(0);
  const key = opts.strategyIds?.join(',') ?? '*';

  useEffect(() => {
    const w = getWorker();
    if (!w) return;
    const t = setTimeout(() => {
      const id = ++seq;
      latest.current = id;
      setRunning(true);
      listeners.set(id, o => { if (latest.current === id) { setOut(o); setRunning(false); } });
      const strats = (opts.strategyIds ? strategies.filter(s => opts.strategyIds!.includes(s.id)) : strategies)
        .map(s => ({ id: s.id, name: s.name, isBaseline: s.isBaseline, leversByParcel: s.leversByParcel }));
      w.postMessage({
        id, grid,
        parcels: simParcels,
        strategies: strats,
        params: opts.durationOverride ? { ...simParams, durationYears: opts.durationOverride } : simParams,
        eco: economics,
      });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, strategies, simParams, economics, simParcels, key, opts.durationOverride]);

  return { out, running, parcels };
}
