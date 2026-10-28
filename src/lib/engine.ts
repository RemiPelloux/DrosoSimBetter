// =============================================================================
// DrosoSim Next — Moteur spatio-temporel Drosophila suzukii (pas journalier)
// Pur TypeScript, zéro allocation dans la boucle chaude. Une exécution complète
// est réalisée PAR stratégie : les leviers modifient réellement la dynamique.
//
// Modèle v2 :
//   • climat journalier déterministe avec variabilité synoptique (tables par
//     profil, pré-calculées une fois par simulation) ;
//   • phénologie thermique : véraison déclenchée par les degrés-jours cumulés,
//     donc décalée selon le profil climatique ;
//   • immatures structurés en 3 sous-stades (délai de développement gamma) ;
//   • capacité d'accueil proportionnelle à la ressource fruitière du jour ;
//   • réponses continues au froid et à la chaleur ;
//   • filet symétrique (freine l'entrée et la sortie) ;
//   • coûts et IFT calculés sur les passages réellement déclenchés.
// La spécification complète est dans docs/11-modele-mathematique.md.
// =============================================================================

export const MODEL_VERSION = '2.0.0';

export type CellType = 'neutral' | 'forest' | 'early-cherry' | 'late-cherry' | 'season-cherry';
export type CherryType = 'early-cherry' | 'late-cherry' | 'season-cherry';
export const CHERRY_TYPES: CherryType[] = ['early-cherry', 'season-cherry', 'late-cherry'];
export const isCherry = (t: CellType): t is CherryType => t === 'early-cherry' || t === 'late-cherry' || t === 'season-cherry';

export interface LeverConfig {
  prophylaxis: boolean;
  harvestRate: number; // % fruits récoltés (80 standard → 98 sanitaire)
  groundFruitDestruction: boolean;
  netting: boolean;
  netType: 'monorang' | 'monoparcelle';
  netDeploy: 'bloom' | 'veraison';
  treatment: boolean;
  treatmentMode: 'conventional' | 'biocontrol';
  treatmentPasses: number; // 1-4
  treatmentTrigger: 'calendar' | 'threshold';
  parasitoids: boolean;
  parasitoidSeason: 'autumn' | 'spring';
  parasitoidDose: 'standard' | 'reinforced';
  tis: boolean;
  tisRatio: number; // ratio mâles stériles / sauvages (5 – 20)
}

export const defaultLeverConfig: LeverConfig = {
  prophylaxis: false, harvestRate: 98, groundFruitDestruction: true,
  netting: false, netType: 'monorang', netDeploy: 'bloom',
  treatment: false, treatmentMode: 'conventional', treatmentPasses: 2, treatmentTrigger: 'calendar',
  parasitoids: false, parasitoidSeason: 'spring', parasitoidDose: 'standard',
  tis: false, tisRatio: 10,
};

export type ClimateProfile = 'mild-winter' | 'harsh-winter' | 'humid-spring' | 'dry-summer';

export interface SimParams {
  startSeason: 'autumn' | 'spring';
  durationYears: number;
  climateProfile: ClimateProfile;
}

export interface LeverCosts {
  netMonorang: number;      // €/ha/an (amorti)
  netMonoparcelle: number;  // €/ha/an (amorti)
  laborHour: number;        // €/h
  phytoConv: number;        // €/passage/ha
  phytoBio: number;         // €/passage/ha
  parasitoidStd: number;    // €/ha
  parasitoidReinf: number;  // €/ha
  tis: number;              // €/ha
}
export const defaultCosts: LeverCosts = {
  netMonorang: 3800, netMonoparcelle: 2600, laborHour: 16, phytoConv: 85, phytoBio: 150,
  parasitoidStd: 300, parasitoidReinf: 520, tis: 950,
};

export interface Economics {
  yieldTPerHa: number;
  pricePerKg: number;
  cellAreaM2: number;
  costs?: LeverCosts;
}

export interface ParcelInfo { id: string; name: string; type: CellType; cells: number[]; }

export interface StrategyInput { id: string; name: string; isBaseline: boolean; leversByParcel: Record<string, LeverConfig>; }

export type EventType = 'treatment' | 'net' | 'harvest' | 'parasitoid' | 'tis';
export interface SimEvent { day: number; type: EventType; parcelId: string; }

export interface SeriesPoint { day: number; label: string; [key: string]: number | string; }

export interface CostBreakdown { net: number; phyto: number; labor: number; bio: number; tis: number; }

export interface StrategyResult {
  id: string;
  name: string;
  isBaseline: boolean;
  series: SeriesPoint[];          // densités femelles/ha par parcelle (clé = parcelId) + 'forest_all' / 'cherry_all'
  damageSeries: SeriesPoint[];    // % fruits sains cumulés par parcelle cerise
  harvestByParcel: Record<string, number>;          // % récolte saine (moyenne sur années)
  harvestByParcelYear: Record<string, number[]>;
  globalHarvest: number;          // % pondéré par la surface (cerisiers)
  peakDensity: number;            // pic femelles/ha (cerisiers)
  peakByCell: Float32Array;       // pic femelles/ha par cellule
  ift: number;                    // IFT chimique moyen / an / ha cerisier
  costs: CostBreakdown;           // € / an (sur l'exploitation)
  totalCost: number;
  revenue: number;                // CA de la récolte saine / an
  laborHours: number;
  events: SimEvent[];
  treatmentsApplied?: number;     // passages réellement déclenchés (tous modes), cumulés sur la simulation
}

export interface PhenologyWindow { type: CherryType; start: number; end: number; }

export interface ClimateSummary {
  tMin: number; tMax: number;
  degreeDays: number;             // somme annuelle des (T − 8)⁺
  coldDays: number;               // jours T < 6 °C
  hotDays: number;                // jours T > 30 °C
}

export interface SimOutput {
  results: StrategyResult[];
  computeMs: number;
  totalDays: number;
  startDayOfYear: number;
  phenology: PhenologyWindow[];   // fenêtres véraison → récolte effectivement utilisées (phénologie thermique)
  modelVersion?: string;
  climate?: ClimateSummary;
}

// ---------------------------------------------------------------- Constantes
const N = 20;
const NC = N * N;
const DAYS = 365;
const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Paramètres biologiques (voir docs/11-modele-mathematique.md, table maître) */
export const PARAMS = {
  fecundity: 8,            // œufs / femelle / jour à l'optimum
  eggSurvival: 0.30,       // fraction d'œufs viables entrant dans la chaîne immature
  stages: 3,               // sous-stades immatures (délai gamma d'ordre 3)
  ddTotal: 210,            // degrés-jours œuf → adulte
  ddBase: 8,               // seuil de développement (°C)
  immatureMort: 0.012,     // mortalité journalière des immatures
  immatureMortCold: 0.03,  // idem si T < 5 °C
  adultMort: 0.028,        // mortalité journalière de base des adultes (≈ 36 j de vie)
  neutralMort: 0.04,       // surmortalité en zone neutre
  crowdMort: 0.15,         // surmortalité par unité de dépassement de la capacité statique (a/K − 1)⁺
  heatT0: 28,              // début du stress thermique (°C)
  heatMortPerDeg: 0.012,   // surmortalité par °C au-dessus de heatT0 (plafond heatMortMax)
  heatMortMax: 0.06,
  coldT0: 6,               // sous cette température la surmortalité hivernale croît linéairement
  coldRamp: 4,             // °C pour atteindre le plein effet
  coldMax: 1.5,            // multiplicateur maximal de la surmortalité hivernale
  winterExtra: { 'mild-winter': 0.016, 'harsh-winter': 0.05, 'humid-spring': 0.028, 'dry-summer': 0.028 } as Record<ClimateProfile, number>,
  forestShelter: 0.5,      // l'espace naturel divise la surmortalité hivernale par 2
  K: { forest: 260, cherry: 700, neutral: 8 }, // capacités d'accueil (femelles / case) à ressource maximale
  kFloor: 0.25,            // plancher de la capacité relative (abri, ressources non modélisées)
  wildMax: 0.40,           // valeur maximale de la ressource sauvage
  damageConst: 3500,       // œufs « efficaces » par case pour un facteur e⁻¹ sur les fruits sains
  residualDecay: 0.965,    // décroissance journalière des fruits résiduels
  dispersalWarm: 0.12,     // fraction émigrante par jour si T > 10 °C
  dispersalCold: 0.03,
  netBlock: 0.7,           // part des mouvements traversant un filet qui sont refoulés
  threshold: 1500,         // seuil de traitement (femelles / ha)
  tisWindow: [80, 260] as const,
  initForestSpring: 20, initForestAutumn: 50, initCherry: 1, // femelles / case au départ
};

/** Fenêtres de référence (climat de référence), jour de l'année — véraison → récolte */
export const PHENOLOGY: Record<CherryType, { veraison: number; harvest: number; label: string }> = {
  'early-cherry': { veraison: 130, harvest: 158, label: 'Précoce' },   // 10 mai → 7 juin
  'season-cherry': { veraison: 150, harvest: 178, label: 'Saison' },   // 30 mai → 27 juin
  'late-cherry': { veraison: 168, harvest: 200, label: 'Tardive' },    // 17 juin → 19 juil
};

export function dayLabel(absDay: number, startDoy: number) {
  const doy = (startDoy + absDay) % DAYS;
  const year = Math.floor((startDoy + absDay) / DAYS) + 1;
  let m = 11;
  while (m > 0 && MONTH_START[m] > doy) m--;
  return { label: `${doy - MONTH_START[m] + 1} ${MONTHS[m]}`, month: MONTHS[m], year, doy };
}

// ---------------------------------------------------------------- Climat
/** Variabilité synoptique déterministe : deux oscillations de périodes incommensurables (± 3,3 °C) */
function synoptic(doy: number) {
  return 2.0 * Math.sin((2 * Math.PI * doy) / 6.9 + 0.7) + 1.3 * Math.sin((2 * Math.PI * doy) / 17.3 + 2.1);
}

/** Température journalière du profil (null = climat de référence, sans correction) */
export function temperature(doy: number, climate: ClimateProfile | null) {
  let t = 12.5 + 10.5 * Math.sin((2 * Math.PI * (doy - 110)) / DAYS) + synoptic(doy);
  const winter = doy < 60 || doy > 320;
  const summer = doy > 160 && doy < 250;
  if (climate === 'mild-winter' && winter) t += 3.5;
  if (climate === 'harsh-winter' && winter) t -= 4;
  if (climate === 'dry-summer' && summer) t += 5;
  if (climate === 'humid-spring' && doy > 80 && doy < 180) t -= 0.5;
  return t;
}

/** Aptitude thermique de la ponte (0-1), optimum 20-26°C, arrêt > 33°C */
export function tempSuitability(t: number) {
  if (t <= 10 || t >= 33) return 0;
  if (t < 20) return (t - 10) / 10;
  if (t <= 26) return 1;
  return (33 - t) / 7;
}

/** Ressource fruitière sauvage (0-1) : ronces, sureau, lierre… avril → décembre, pic fin d'été */
export function wildResource(doy: number) {
  if (doy < 95) return 0.05;
  return 0.12 + 0.28 * Math.max(0, Math.sin((Math.PI * (doy - 95)) / 270));
}

export interface ClimateTable {
  T: Float64Array;        // température
  suit: Float64Array;     // φ(T)
  dev: Float64Array;      // δ(T) : fraction de développement journalier (0-1)
  wild: Float64Array;     // ρ_nat
  disp: Float64Array;     // D
  coldF: Float64Array;    // multiplicateur de surmortalité hivernale (0 – coldMax)
  heat: Float64Array;     // surmortalité thermique
  immMort: Float64Array;  // μ_L
  cumDD: Float64Array;    // degrés-jours cumulés depuis le 1er janvier
  winterExtra: number;    // μ_hiv du profil
  humid: boolean;
  summary: ClimateSummary;
}

const climateCache = new Map<string, ClimateTable>();
/** Vide le cache des tables climatiques (nécessaire après modification de PARAMS, ex. calibration) */
export function resetClimateCache() { climateCache.clear(); }
export function climateTable(profile: ClimateProfile | null): ClimateTable {
  const key = profile ?? 'reference';
  const hit = climateCache.get(key);
  if (hit) return hit;
  const T = new Float64Array(DAYS), suit = new Float64Array(DAYS), dev = new Float64Array(DAYS), wild = new Float64Array(DAYS);
  const disp = new Float64Array(DAYS), coldF = new Float64Array(DAYS), heat = new Float64Array(DAYS), immMort = new Float64Array(DAYS), cumDD = new Float64Array(DAYS);
  let acc = 0, tMin = Infinity, tMax = -Infinity, coldDays = 0, hotDays = 0;
  for (let j = 0; j < DAYS; j++) {
    const t = temperature(j, profile);
    T[j] = t;
    suit[j] = tempSuitability(t);
    const dd = Math.max(0, t - PARAMS.ddBase);
    acc += dd; cumDD[j] = acc;
    dev[j] = Math.min(1, dd / PARAMS.ddTotal);
    wild[j] = wildResource(j);
    disp[j] = t > 10 ? PARAMS.dispersalWarm : PARAMS.dispersalCold;
    coldF[j] = t < PARAMS.coldT0 ? Math.min(PARAMS.coldMax, (PARAMS.coldT0 - t) / PARAMS.coldRamp) : 0;
    heat[j] = t > PARAMS.heatT0 ? Math.min(PARAMS.heatMortMax, (t - PARAMS.heatT0) * PARAMS.heatMortPerDeg) : 0;
    immMort[j] = t < 5 ? PARAMS.immatureMortCold : PARAMS.immatureMort;
    if (t < tMin) tMin = t; if (t > tMax) tMax = t;
    if (t < 6) coldDays++; if (t > 30) hotDays++;
  }
  const table: ClimateTable = {
    T, suit, dev, wild, disp, coldF, heat, immMort, cumDD,
    winterExtra: profile ? PARAMS.winterExtra[profile] : PARAMS.winterExtra['humid-spring'],
    humid: profile === 'humid-spring',
    summary: { tMin: Math.round(tMin * 10) / 10, tMax: Math.round(tMax * 10) / 10, degreeDays: Math.round(acc), coldDays, hotDays },
  };
  climateCache.set(key, table);
  return table;
}

// ---------------------------------------------------------------- Phénologie thermique
/** Seuils de degrés-jours atteints aux dates de référence dans le climat de référence */
const REF_DD: Record<CherryType, number> = (() => {
  const ref = climateTable(null).cumDD;
  return { 'early-cherry': ref[130], 'season-cherry': ref[150], 'late-cherry': ref[168] };
})();
const RIPENING_DAYS: Record<CherryType, number> = { 'early-cherry': 28, 'season-cherry': 28, 'late-cherry': 32 };

/** Dates de véraison / récolte du profil : véraison au jour où les degrés-jours cumulés atteignent le seuil de référence */
export function thermalPhenology(profile: ClimateProfile | null): Record<CherryType, { veraison: number; harvest: number }> {
  const cum = climateTable(profile).cumDD;
  const out = {} as Record<CherryType, { veraison: number; harvest: number }>;
  for (const t of CHERRY_TYPES) {
    let v = PHENOLOGY[t].veraison;
    for (let j = 60; j < 300; j++) if (cum[j] >= REF_DD[t]) { v = j; break; }
    out[t] = { veraison: v, harvest: v + RIPENING_DAYS[t] };
  }
  return out;
}

// ---------------------------------------------------------------- Voisinage (statique, partagé)
const NBR_START = new Int32Array(NC + 1);
const NBR = (() => {
  const flat: number[] = [];
  for (let i = 0; i < NC; i++) {
    NBR_START[i] = flat.length;
    const x = i % N, y = (i / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < N && ny >= 0 && ny < N) flat.push(ny * N + nx);
    }
  }
  NBR_START[NC] = flat.length;
  return Int32Array.from(flat);
})();

// ------------------------------------------------------------------ Simulation
export function simulate(
  grid: CellType[],
  parcels: ParcelInfo[],
  strategies: StrategyInput[],
  params: SimParams,
  eco: Economics,
): SimOutput {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const startDoy = params.startSeason === 'spring' ? 59 : 273; // 1 mars / 1 oct
  const totalDays = params.durationYears * DAYS + (params.startSeason === 'autumn' ? 92 : 0);
  // départ automne : on ajoute l'hiver complet pour couvrir N saisons de récolte
  const cl = climateTable(params.climateProfile);
  const pheno = thermalPhenology(params.climateProfile);
  const toHa = 10000 / eco.cellAreaM2;
  const haPerCell = eco.cellAreaM2 / 10000;
  const NP = parcels.length;

  // Parcelles → tableaux plats (aucune fermeture dans la boucle journalière)
  const cellParcel = new Int16Array(NC).fill(-1);
  const pStart = new Int32Array(NP + 1);
  const pCellsFlat: number[] = [];
  const pIsCherry = new Uint8Array(NP), pVer = new Int16Array(NP), pHar = new Int16Array(NP);
  parcels.forEach((p, pi) => {
    pStart[pi] = pCellsFlat.length;
    for (const c of p.cells) { cellParcel[c] = pi; pCellsFlat.push(c); }
    if (isCherry(p.type)) { pIsCherry[pi] = 1; pVer[pi] = pheno[p.type].veraison; pHar[pi] = pheno[p.type].harvest; }
  });
  pStart[NP] = pCellsFlat.length;
  const pCells = Int32Array.from(pCellsFlat);

  // Cellules : nature, fenêtre phénologique
  const kind = new Int8Array(NC); // 0 neutre, 1 espace naturel, 2 cerisier
  const ver = new Int16Array(NC), har = new Int16Array(NC);
  for (let c = 0; c < NC; c++) {
    const t = grid[c];
    kind[c] = t === 'forest' ? 1 : isCherry(t) ? 2 : 0;
    if (isCherry(t)) { ver[c] = pheno[t].veraison; har[c] = pheno[t].harvest; }
  }

  const phenology: PhenologyWindow[] = CHERRY_TYPES.filter(t => grid.includes(t)).map(t => ({ type: t, start: pheno[t].veraison, end: pheno[t].harvest }));

  // Tampons partagés entre stratégies (réinitialisés dans runStrategy)
  const attr = new Float64Array(NC);
  const netNow = new Float64Array(NC);
  const A = new Float64Array(NC);       // femelles adultes / case
  const S = new Float64Array(NC * 3);   // sous-stades immatures entrelacés : S[3c], S[3c+1], S[3c+2]
  const nextA = new Float64Array(NC);
  const healthy = new Float64Array(NC);
  const residual = new Float64Array(NC);
  const netE = new Float32Array(NC), netD = new Int16Array(NC), netEnd = new Int16Array(NC);
  const tisF = new Float32Array(NC);
  const residAfter = new Float32Array(NC);
  const paraF = new Float32Array(NC);   // fraction de larves échappant aux parasitoïdes
  const paraOn = new Uint8Array(NC);
  const paraDose = new Float32Array(NC);
  const lastTreat = new Int32Array(NP), treatCount = new Int32Array(NP), treatRemain = new Int32Array(NP);
  const treatKill = new Float32Array(NP), passesConv = new Int32Array(NP), passesBio = new Int32Array(NP);

  const results = strategies.map(s => runStrategy(s));
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { results, computeMs: t1 - t0, totalDays, startDayOfYear: startDoy, phenology, modelVersion: MODEL_VERSION, climate: cl.summary };

  function runStrategy(strategy: StrategyInput): StrategyResult {
    const levers: (LeverConfig | null)[] = parcels.map(p => (strategy.isBaseline ? null : strategy.leversByParcel[p.id] ?? null));

    // --- Paramétrage par cellule depuis les leviers de sa parcelle
    netE.fill(0); netD.fill(0); netEnd.fill(0); tisF.fill(1); residAfter.fill(0); paraF.fill(1); paraOn.fill(0); paraDose.fill(1);
    for (let c = 0; c < NC; c++) {
      const pi = cellParcel[c];
      const l = pi >= 0 ? levers[pi] : null;
      if (kind[c] === 2) {
        if (l?.netting) {
          netE[c] = l.netType === 'monorang' ? 0.95 : 0.85;
          netD[c] = l.netDeploy === 'bloom' ? 105 : ver[c] - 5;
          netEnd[c] = har[c] + 5;
        }
        const hr = l?.prophylaxis ? l.harvestRate / 100 : 0.8;
        residAfter[c] = (1 - hr) * (l?.prophylaxis && l.groundFruitDestruction ? 0.25 : 1);
        if (l?.tis) tisF[c] = 1 / (1 + l.tisRatio * 0.12);
      }
      if (l?.parasitoids) { paraOn[c] = 1; paraDose[c] = l.parasitoidDose === 'reinforced' ? 1.4 : 1; }
    }
    const updateParasitoids = (seasonYears: number) => {
      const install = Math.min(1, 0.35 + 0.33 * seasonYears);
      for (let c = 0; c < NC; c++) paraF[c] = paraOn[c] ? 1 - Math.min(0.75, 0.38 * install * paraDose[c]) : 1;
    };
    let lastSeasonYears = -1;

    // --- États initiaux
    S.fill(0); healthy.fill(1); residual.fill(0);
    const peak = new Float32Array(NC);
    lastTreat.fill(-999); treatCount.fill(0); treatRemain.fill(0); treatKill.fill(0); passesConv.fill(0); passesBio.fill(0);
    for (let c = 0; c < NC; c++) {
      A[c] = kind[c] === 1 ? (params.startSeason === 'autumn' ? PARAMS.initForestAutumn : PARAMS.initForestSpring) : kind[c] === 2 ? PARAMS.initCherry : 0;
    }

    const harvestYear: Record<string, number[]> = {};
    const harvestArr: (number[] | null)[] = parcels.map(p => (isCherry(p.type) ? (harvestYear[p.id] = []) : null));
    const events: SimEvent[] = [];
    const series: SeriesPoint[] = [];
    const damageSeries: SeriesPoint[] = [];
    let iftTotal = 0;

    const humidF = cl.humid ? 1.25 : 1;
    const remanenceF = cl.humid ? 0.6 : 1;
    const KF = PARAMS.K.forest, KCh = PARAMS.K.cherry, KN = PARAMS.K.neutral;
    const FEC = PARAMS.fecundity, SIG = PARAMS.eggSurvival, STG = PARAMS.stages;
    const DMG = 1 / PARAMS.damageConst, DECAY = PARAMS.residualDecay, BLOCK = PARAMS.netBlock, CROWD = PARAMS.crowdMort;
    const KFLOOR = PARAMS.kFloor, SHELTER = PARAMS.forestShelter, NMORT = PARAMS.neutralMort;
    const thresholdPerCell = PARAMS.threshold / toHa;
    const [tis0, tis1] = PARAMS.tisWindow;

    // --- Événements statiques (filets, lâchers, TIS)
    for (let y = 0; y < params.durationYears + 1; y++) {
      for (let pi = 0; pi < NP; pi++) {
        const l = levers[pi];
        if (!l) continue;
        const p = parcels[pi];
        const base = y * DAYS - startDoy;
        if (l.netting && pIsCherry[pi]) {
          const d = base + (l.netDeploy === 'bloom' ? 105 : pVer[pi] - 5);
          if (d >= 0 && d < totalDays) events.push({ day: d, type: 'net', parcelId: p.id });
        }
        if (l.parasitoids) {
          const d = base + (l.parasitoidSeason === 'spring' ? 100 : 280);
          if (d >= 0 && d < totalDays) events.push({ day: d, type: 'parasitoid', parcelId: p.id });
        }
        if (l.tis && pIsCherry[pi]) {
          const d = base + tis0;
          if (d >= 0 && d < totalDays) events.push({ day: d, type: 'tis', parcelId: p.id });
        }
      }
    }

    // ================================================================ Boucle journalière
    for (let day = 0; day < totalDays; day++) {
      const doy = (startDoy + day) % DAYS;
      const yearIdx = ((startDoy + day) / DAYS) | 0;
      const seasonYears = Math.max(0, yearIdx - (params.startSeason === 'autumn' ? 1 : 0));
      if (seasonYears !== lastSeasonYears) { updateParasitoids(seasonYears); lastSeasonYears = seasonYears; }

      const suit = cl.suit[doy];
      const devStage = Math.min(1, STG * cl.dev[doy]); // transition par sous-stade (délai gamma d'ordre STG)
      const wild = cl.wild[doy];
      const D = cl.disp[doy];
      const keep = 1 - cl.immMort[doy];
      const coldMort = cl.coldF[doy] * cl.winterExtra;
      const baseMort = PARAMS.adultMort + cl.heat[doy];
      const tisOn = doy >= tis0 && doy <= tis1;
      const kWild = KF * Math.max(KFLOOR, wild / PARAMS.wildMax);

      // Nouvelle année : réinitialisation des fruits sains et des compteurs de passages
      if (doy === 0) { healthy.fill(1); treatCount.fill(0); }

      // --- Déclenchement des traitements (par parcelle)
      for (let pi = 0; pi < NP; pi++) {
        const l = levers[pi];
        if (!l || !l.treatment || !pIsCherry[pi]) continue;
        const v = pVer[pi], h = pHar[pi];
        if (doy < v - 3 || doy > h - 3) continue; // délai avant récolte
        if (treatCount[pi] >= l.treatmentPasses || day - lastTreat[pi] < 7) continue;
        let trigger = false;
        if (l.treatmentTrigger === 'calendar') {
          const span = h - 3 - v;
          trigger = doy >= v + Math.round((span * treatCount[pi]) / l.treatmentPasses);
        } else {
          let s = 0;
          for (let k = pStart[pi]; k < pStart[pi + 1]; k++) s += A[pCells[k]];
          trigger = s / (pStart[pi + 1] - pStart[pi]) > thresholdPerCell;
        }
        if (trigger) {
          lastTreat[pi] = day;
          treatCount[pi]++;
          const conv = l.treatmentMode === 'conventional';
          treatRemain[pi] = Math.round((conv ? 7 : 4) * remanenceF);
          treatKill[pi] = conv ? 0.32 : 0.16;
          if (conv) { iftTotal += pStart[pi + 1] - pStart[pi]; passesConv[pi]++; } else passesBio[pi]++;
          events.push({ day, type: 'treatment', parcelId: parcels[pi].id });
        }
      }

      // --- Dynamique locale (une seule passe : ressource, capacité, attractivité, ponte, développement, mortalité)
      for (let c = 0; c < NC; c++) {
        const k = kind[c];
        let a = A[c];
        const dA = a * toHa; if (dA > peak[c]) peak[c] = dA; // pic (état après dispersion de la veille)
        const i3 = c * 3;
        const s1 = S[i3], s2 = S[i3 + 1], s3 = S[i3 + 2];
        if (k === 0 && a < 1e-6 && s1 < 1e-6 && s2 < 1e-6 && s3 < 1e-6) { A[c] = 0; S[i3] = 0; S[i3 + 1] = 0; S[i3 + 2] = 0; attr[c] = 0.15; netNow[c] = 0; continue; }

        // ressource ρ, capacité K, attractivité w, filet η
        let res = 0.003, K = KN, Ks = KN, at = 0.15, ne = 0, fruit = false;
        if (k === 1) { res = wild; K = kWild; Ks = KF; at = 0.6 + wild; }
        else if (k === 2) {
          const v = ver[c], h = har[c];
          if (doy >= v && doy < h) { res = 1; fruit = true; at = 3; }
          else if (doy >= h) {
            if (doy === h) residual[c] = residAfter[c]; else residual[c] *= DECAY;
            const r = residual[c];
            res = 1.4 * r + 0.02; at = 0.3 + 3 * r;
          } else { res = 0.02; at = doy >= v - 5 ? 3 : 0.25; }
          K = KCh * (res > KFLOOR ? res : KFLOOR); Ks = KCh;
          if (netE[c] > 0 && doy >= netD[c] && doy <= netEnd[c]) ne = netE[c];
        }
        attr[c] = at; netNow[c] = ne;

        // ponte (densité-dépendance sur la ressource du jour)
        const dd = a < K ? 1 - a / K : 0;
        const eggs = a * FEC * suit * res * (1 - ne) * (tisOn ? tisF[c] : 1) * dd * humidF;
        if (fruit && eggs > 0) healthy[c] *= Math.exp(-eggs * DMG);

        // chaîne immature : S1 → S2 → S3 → adultes ; parasitoïdes à la sortie du stade larvaire (S2)
        const o1 = s1 * devStage, o2 = s2 * devStage, o3 = s3 * devStage;
        S[i3] = (s1 - o1) * keep + eggs * SIG;
        S[i3 + 1] = (s2 - o2) * keep + o1;
        S[i3 + 2] = (s3 - o3) * keep + o2 * paraF[c];
        const emerge = o3;

        // adultes
        let mort = baseMort;
        if (coldMort > 0) mort += coldMort * (k === 1 ? SHELTER : 1);
        if (k === 0) mort += NMORT;
        if (a > Ks) mort += CROWD * (a / Ks - 1);
        const pi = cellParcel[c];
        if (pi >= 0 && treatRemain[pi] > 0) mort += treatKill[pi];
        if (mort > 0.95) mort = 0.95;
        a = a * (1 - mort) + emerge;
        A[c] = a > 1e-9 ? a : 0;
      }
      for (let pi = 0; pi < NP; pi++) if (treatRemain[pi] > 0) treatRemain[pi]--;

      // --- Dispersion (attractivité pondérée ; le filet freine l'entrée ET la sortie)
      nextA.set(A);
      for (let c = 0; c < NC; c++) {
        const out = A[c] * D * (1 - BLOCK * netNow[c]);
        if (out < 1e-4) continue;
        const k0 = NBR_START[c], k1 = NBR_START[c + 1];
        let wsum = 0;
        for (let k = k0; k < k1; k++) wsum += attr[NBR[k]];
        if (wsum <= 0) continue;
        const f = out / wsum;
        let back = -out;
        for (let k = k0; k < k1; k++) {
          const n = NBR[k];
          const share = f * attr[n];
          const blocked = share * BLOCK * netNow[n];
          nextA[n] += share - blocked;
          back += blocked; // refoulés par le filet de destination
        }
        nextA[c] += back;
      }
      A.set(nextA);

      // --- Bilan du jour : récoltes, échantillonnage
      for (let pi = 0; pi < NP; pi++) {
        if (!pIsCherry[pi] || doy !== pHar[pi]) continue;
        let h = 0;
        for (let k = pStart[pi]; k < pStart[pi + 1]; k++) h += healthy[pCells[k]];
        harvestArr[pi]!.push((h / (pStart[pi + 1] - pStart[pi])) * 100);
        events.push({ day, type: 'harvest', parcelId: parcels[pi].id });
      }

      if (day % 3 === 0 || day === totalDays - 1) {
        const { label } = dayLabel(day, startDoy);
        const yr = yearIdx + 1;
        const pt: SeriesPoint = { day, label: `${label} A${yr}` };
        const dp: SeriesPoint = { day, label: `${label} A${yr}` };
        let fs = 0, fn = 0, cs = 0, cn = 0;
        for (let pi = 0; pi < NP; pi++) {
          let s = 0, h = 0;
          const n = pStart[pi + 1] - pStart[pi];
          for (let k = pStart[pi]; k < pStart[pi + 1]; k++) { const c = pCells[k]; s += A[c]; h += healthy[c]; }
          pt[parcels[pi].id] = Math.round((s / n) * toHa);
          if (pIsCherry[pi]) { dp[parcels[pi].id] = Math.round((h / n) * 1000) / 10; cs += s; cn += n; }
          else if (kind[pCells[pStart[pi]]] === 1) { fs += s; fn += n; }
        }
        pt.forest_all = fn ? Math.round((fs / fn) * toHa) : 0;
        pt.cherry_all = cn ? Math.round((cs / cn) * toHa) : 0;
        series.push(pt);
        damageSeries.push(dp);
      }
    }

    for (let c = 0; c < NC; c++) { const d = A[c] * toHa; if (d > peak[c]) peak[c] = d; } // pic du dernier jour

    // ------------------------------------------------- Agrégats technico-éco
    const harvestByParcel: Record<string, number> = {};
    let wsum = 0, wh = 0, revenue = 0, peakDensity = 0;
    for (let pi = 0; pi < NP; pi++) {
      if (!pIsCherry[pi]) continue;
      const p = parcels[pi];
      const arr = harvestArr[pi]!;
      const v = arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 100;
      harvestByParcel[p.id] = Math.round(v * 10) / 10;
      const n = pStart[pi + 1] - pStart[pi];
      wsum += n; wh += v * n;
      revenue += n * haPerCell * eco.yieldTPerHa * 1000 * eco.pricePerKg * (v / 100);
      for (let k = pStart[pi]; k < pStart[pi + 1]; k++) if (peak[pCells[k]] > peakDensity) peakDensity = peak[pCells[k]];
    }

    const costs: CostBreakdown = { net: 0, phyto: 0, labor: 0, bio: 0, tis: 0 };
    let laborHours = 0, treatmentsApplied = 0;
    const years = Math.max(1, params.durationYears);
    const K$ = { ...defaultCosts, ...(eco.costs ?? {}) };
    for (let pi = 0; pi < NP; pi++) {
      const l = levers[pi];
      if (!l) continue;
      const ha = (pStart[pi + 1] - pStart[pi]) * haPerCell;
      if (pIsCherry[pi]) {
        if (l.netting) { costs.net += ha * (l.netType === 'monorang' ? K$.netMonorang : K$.netMonoparcelle); laborHours += ha * 40; costs.labor += ha * 40 * K$.laborHour; }
        if (l.prophylaxis) {
          const h = ha * (l.harvestRate >= 95 ? 90 : 55) + (l.groundFruitDestruction ? ha * 25 : 0);
          laborHours += h; costs.labor += h * K$.laborHour;
        }
        if (l.treatment) {
          // passages réellement déclenchés, ramenés à l'année (cohérent avec l'IFT)
          const conv = passesConv[pi] / years, bio = passesBio[pi] / years;
          treatmentsApplied += passesConv[pi] + passesBio[pi];
          costs.phyto += ha * (conv * K$.phytoConv + bio * K$.phytoBio);
          const hrs = ha * (conv + bio) * 1.5;
          laborHours += hrs; costs.labor += hrs * K$.laborHour;
        }
        if (l.tis) costs.tis += ha * K$.tis;
      }
      if (l.parasitoids) costs.bio += ha * (l.parasitoidDose === 'reinforced' ? K$.parasitoidReinf : K$.parasitoidStd);
    }
    const totalCost = costs.net + costs.phyto + costs.labor + costs.bio + costs.tis;

    return {
      id: strategy.id,
      name: strategy.name,
      isBaseline: strategy.isBaseline,
      series, damageSeries,
      harvestByParcel,
      harvestByParcelYear: harvestYear,
      globalHarvest: wsum ? Math.round((wh / wsum) * 10) / 10 : 100,
      peakDensity: Math.round(peakDensity),
      peakByCell: peak,
      ift: Math.round((iftTotal / (wsum || 1) / years) * 10) / 10,
      costs: { net: Math.round(costs.net), phyto: Math.round(costs.phyto), labor: Math.round(costs.labor), bio: Math.round(costs.bio), tis: Math.round(costs.tis) },
      totalCost: Math.round(totalCost),
      revenue: Math.round(revenue),
      laborHours: Math.round(laborHours),
      events: events.sort((a, b) => a.day - b.day),
      treatmentsApplied,
    };
  }
}

// ---------------------------------------------------------------- Parcelles
export const TYPE_LABEL: Record<CellType, string> = {
  neutral: 'Zone neutre', forest: 'Espace Naturel', 'early-cherry': 'Cerise Précoce',
  'late-cherry': 'Cerise Tardive', 'season-cherry': 'Cerise de Saison',
};
export const TYPE_COLOR: Record<CellType, string> = {
  neutral: '#F1F5F9', forest: '#15803D', 'early-cherry': '#D97706', 'late-cherry': '#991B1B', 'season-cherry': '#E11D48',
};
export const TYPE_EMOJI: Record<CellType, string> = {
  neutral: '⬜', forest: '🌲', 'early-cherry': '🍒', 'late-cherry': '🍒', 'season-cherry': '🍒',
};

/**
 * Détection des parcelles (composantes 4-connexes de même type).
 * Mise en cache par référence de grille : la grille est immuable dans le store
 * (chaque modification crée un nouveau tableau), donc plusieurs consommateurs
 * (store, simulation, éditeur, leviers) partagent un seul calcul par modification.
 * Le résultat est partagé : ne pas le muter.
 */
const parcelCache = new WeakMap<CellType[], ParcelInfo[]>();
export function detectParcels(grid: CellType[]): ParcelInfo[] {
  const hit = parcelCache.get(grid);
  if (hit) return hit;
  const res = computeParcels(grid);
  parcelCache.set(grid, res);
  return res;
}

function computeParcels(grid: CellType[]): ParcelInfo[] {
  const seen = new Uint8Array(NC);
  const counter: Record<string, number> = {};
  const out: ParcelInfo[] = [];
  for (let i = 0; i < NC; i++) {
    if (grid[i] === 'neutral' || seen[i]) continue;
    const type = grid[i];
    const q = [i]; seen[i] = 1;
    const cells: number[] = [];
    while (q.length) {
      const c = q.pop()!;
      cells.push(c);
      const x = c % N, y = (c / N) | 0;
      const ns = [x > 0 ? c - 1 : -1, x < N - 1 ? c + 1 : -1, y > 0 ? c - N : -1, y < N - 1 ? c + N : -1];
      for (const n of ns) if (n >= 0 && !seen[n] && grid[n] === type) { seen[n] = 1; q.push(n); }
    }
    counter[type] = (counter[type] ?? 0) + 1;
    out.push({ id: `${type}-${counter[type]}`, name: `${TYPE_LABEL[type]}-${counter[type]}`, type, cells: cells.sort((a, b) => a - b) });
  }
  return out;
}
