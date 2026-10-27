import { simulate, type CellType, type ParcelInfo, type StrategyInput, type SimParams, type Economics } from './engine';

export interface SimRequest { id: number; grid: CellType[]; parcels: ParcelInfo[]; strategies: StrategyInput[]; params: SimParams; eco: Economics; }

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, grid, parcels, strategies, params, eco } = e.data;
  const out = simulate(grid, parcels, strategies, params, eco);
  (self as unknown as Worker).postMessage({ id, out });
};
