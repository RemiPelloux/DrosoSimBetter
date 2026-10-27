// =============================================================================
// Tests du moteur de simulation (sans navigateur)        npm run test:engine
// Vérifie la robustesse numérique, les invariants et la cohérence agronomique.
// =============================================================================
import { simulate, detectParcels, defaultLeverConfig, type CellType, type LeverConfig, type SimParams } from '../src/lib/engine.ts';
// @ts-expect-error — module JS sans types
import { createSuite } from './lib/harness.mjs';

const t = createSuite('Moteur de simulation');
const N = 20, NC = N * N;
const eco = { yieldTPerHa: 10, pricePerKg: 3.5, cellAreaM2: 100 };

// ---------------------------------------------------------------- grilles de test
const mixed: CellType[] = Array(NC).fill('neutral');
for (let i = 0; i < 60; i++) mixed[i] = 'forest';
for (let y = 5; y < 15; y++) for (let x = 0; x < N; x++) mixed[y * N + x] = x < 7 ? 'early-cherry' : x < 14 ? 'season-cherry' : 'late-cherry';
const grids: Record<string, CellType[]> = { vide: Array(NC).fill('neutral'), 'forêt seule': Array(NC).fill('forest'), mixte: mixed };

const strategiesFor = (grid: CellType[], patch: Partial<LeverConfig>) => {
  const levers = Object.fromEntries(detectParcels(grid).map(p => [p.id, { ...defaultLeverConfig, ...patch }]));
  return [
    { id: 'base', name: 'Témoin', isBaseline: true, leversByParcel: {} },
    { id: 'strat', name: 'Stratégie', isBaseline: false, leversByParcel: levers },
  ];
};
const run = (grid: CellType[], params: SimParams, patch: Partial<LeverConfig> = { treatment: true, treatmentTrigger: 'threshold', parasitoids: true }) =>
  simulate(grid, detectParcels(grid), strategiesFor(grid, patch), params, eco);

// ---------------------------------------------------------------- 1. détection des parcelles
const parcels = detectParcels(mixed);
t.check('détection des parcelles du verger mixte', parcels.length === 4, parcels.map(p => `${p.id}(${p.cells.length})`).join(' '));
t.check('cache de détection (même grille → même objet)', detectParcels(mixed) === parcels);

// ---------------------------------------------------------------- 2. matrice de robustesse (48 scénarios)
let scenarios = 0, numericErrors = 0, harvestCountErrors = 0, boundErrors = 0;
for (const [name, grid] of Object.entries(grids))
  for (const startSeason of ['spring', 'autumn'] as const)
    for (const climateProfile of ['mild-winter', 'harsh-winter', 'humid-spring', 'dry-summer'] as const)
      for (const durationYears of [1, 3]) {
        scenarios++;
        const o = run(grid, { startSeason, durationYears, climateProfile });
        const flat = JSON.stringify(o.results.map(r => [r.globalHarvest, r.peakDensity, r.ift, r.totalCost, r.revenue, r.series.at(-1)]));
        if (/null|NaN|Infinity/.test(flat)) { numericErrors++; console.log(`    NaN : ${name} · ${startSeason} · ${climateProfile} · ${durationYears} an(s)`); }
        for (const r of o.results) {
          if (r.globalHarvest < 0 || r.globalHarvest > 100) boundErrors++;
          for (const arr of Object.values(r.harvestByParcelYear)) if (arr.length !== durationYears) harvestCountErrors++;
        }
      }
t.check(`${scenarios} scénarios sans valeur non numérique`, numericErrors === 0, `${numericErrors} en erreur`);
t.check('une récolte par an et par parcelle de cerisiers', harvestCountErrors === 0, `${harvestCountErrors} écarts`);
t.check('récolte globale comprise entre 0 et 100 %', boundErrors === 0);

// ---------------------------------------------------------------- 3. déterminisme
const p1: SimParams = { startSeason: 'spring', durationYears: 2, climateProfile: 'mild-winter' };
const a = run(mixed, p1), b = run(mixed, p1);
t.check('déterminisme (même entrée → même sortie)', JSON.stringify(a.results.map(r => r.harvestByParcel)) === JSON.stringify(b.results.map(r => r.harvestByParcel)));

// ---------------------------------------------------------------- 4. cohérence agronomique
const y1 = run(mixed, { startSeason: 'spring', durationYears: 1, climateProfile: 'mild-winter' }).results[0].harvestByParcel;
t.check('témoin année 1 : la précoce échappe au pic, la tardive est touchée', y1['early-cherry-1'] > y1['late-cherry-1'], `précoce ${y1['early-cherry-1']} % · tardive ${y1['late-cherry-1']} %`);
const net = run(mixed, p1, { netting: true });
t.check('le filet améliore la récolte', net.results[1].globalHarvest > net.results[0].globalHarvest, `${net.results[0].globalHarvest} → ${net.results[1].globalHarvest} %`);
const harsh = run(mixed, { ...p1, climateProfile: 'harsh-winter' }).results[0].globalHarvest;
const mild = run(mixed, p1).results[0].globalHarvest;
t.check('un hiver rigoureux réduit la pression', harsh >= mild, `doux ${mild} % · rigoureux ${harsh} %`);
const conv = run(mixed, p1, { treatment: true, treatmentMode: 'conventional', treatmentPasses: 2 }).results[1];
const bio = run(mixed, p1, { treatment: true, treatmentMode: 'biocontrol', treatmentPasses: 2 }).results[1];
t.check('le biocontrôle ne compte pas dans l’IFT chimique', conv.ift > 0 && bio.ift === 0, `conventionnel ${conv.ift} · biocontrôle ${bio.ift}`);
t.check('aucun coût pour le témoin', a.results[0].totalCost === 0);

// ---------------------------------------------------------------- 5. performance
const perf: SimParams = { startSeason: 'spring', durationYears: 3, climateProfile: 'mild-winter' };
const [base, netS] = strategiesFor(mixed, { netting: true });
const tisS = strategiesFor(mixed, { tis: true })[1], allS = strategiesFor(mixed, { prophylaxis: true, parasitoids: true, treatment: true })[1];
const four = [base, netS, { ...tisS, id: 's3' }, { ...allS, id: 's4' }];
for (let i = 0; i < 2; i++) simulate(mixed, parcels, four, perf, eco); // préchauffage du JIT
const t0 = performance.now();
for (let i = 0; i < 5; i++) simulate(mixed, parcels, four, perf, eco);
const ms = (performance.now() - t0) / 5;
const budget = Number(process.env.ENGINE_BUDGET_MS ?? 600);
t.check(`performance : ${four.length} stratégies × 3 ans < ${budget} ms`, ms < budget, `${ms.toFixed(0)} ms`);

t.done();
