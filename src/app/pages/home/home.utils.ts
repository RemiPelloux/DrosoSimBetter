import { buildTemplate } from '@/lib/store';
import { type StrategyResult } from '@/lib/engine';

// --------------------------------------------------------------- Démo réelle (calculée par le moteur)
export const DEMO_GRID = buildTemplate('mixed');
export type Run = { base: StrategyResult; pbi: StrategyResult; max: number; ms: number };

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
