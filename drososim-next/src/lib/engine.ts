// =============================================================================
// DrosoSim Next — Moteur spatio-temporel Drosophila suzukii (pas journalier)
// Pur TypeScript, zéro allocation dans la boucle chaude. Une exécution complète
// est réalisée PAR stratégie : les leviers modifient réellement la dynamique.
// =============================================================================

export type CellType = 'neutral' | 'forest' | 'early-cherry' | 'late-cherry' | 'season-cherry';
export const CHERRY_TYPES: CellType[] = ['early-cherry', 'season-cherry', 'late-cherry'];
export const isCherry = (t: CellType) => t === 'early-cherry' || t === 'late-cherry' || t === 'season-cherry';

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
  series: SeriesPoint[];          // densités femelles/ha par parcelle (clé = parcelId) + 'forest_all'
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
}

export interface SimOutput {
  results: StrategyResult[];
  computeMs: number;
  totalDays: number;
  startDayOfYear: number;
  phenology: { type: CellType; start: number; end: number }[];
}

// ---------------------------------------------------------------- Constantes
const N = 20;
const NC = N * N;
const DAYS = 365;
const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Fenêtres de sensibilité (véraison → récolte), jour de l'année */
export const PHENOLOGY: Record<string, { veraison: number; harvest: number; label: string }> = {
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

function temperature(doy: number, climate: ClimateProfile) {
  let t = 12.5 + 10.5 * Math.sin((2 * Math.PI * (doy - 110)) / DAYS);
  const winter = doy < 60 || doy > 320;
  const summer = doy > 160 && doy < 250;
  if (climate === 'mild-winter' && winter) t += 3.5;
  if (climate === 'harsh-winter' && winter) t -= 4;
  if (climate === 'dry-summer' && summer) t += 5;
  if (climate === 'humid-spring' && doy > 80 && doy < 180) t -= 0.5;
  return t;
}

/** Aptitude thermique de la ponte (0-1), optimum 20-25°C, arrêt > 32°C */
function tempSuitability(t: number) {
  if (t <= 10 || t >= 33) return 0;
  if (t < 20) return (t - 10) / 10;
  if (t <= 26) return 1;
  return (33 - t) / 7;
}

/** Ressource fruitière disponible pour la ponte (0-1) dans la cellule */
function wildResource(doy: number) {
  // ronces, sureau, lierre… étalé avril → décembre avec pic fin d'été
  if (doy < 95) return 0.05;
  return 0.12 + 0.28 * Math.max(0, Math.sin((Math.PI * (doy - 95)) / 270));
}

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

  // Pré-calcul des correspondances cellule → parcelle
  const cellParcel = new Int16Array(NC).fill(-1);
  parcels.forEach((p, pi) => p.cells.forEach(c => (cellParcel[c] = pi)));

  // Voisinage 8-connexe pré-calculé
  const nbrStart = new Int32Array(NC + 1);
  const nbrFlat: number[] = [];
  for (let i = 0; i < NC; i++) {
    nbrStart[i] = nbrFlat.length;
    const x = i % N, y = (i / N) | 0, list: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < N && ny >= 0 && ny < N) list.push(ny * N + nx);
    }
    nbrFlat.push(...list);
  }
  nbrStart[NC] = nbrFlat.length;
  const nbr = Int32Array.from(nbrFlat);

  const phenology = CHERRY_TYPES.filter(t => grid.includes(t)).map(t => ({ type: t, start: PHENOLOGY[t].veraison, end: PHENOLOGY[t].harvest }));

  const results = strategies.map(s => runStrategy(s));
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { results, computeMs: t1 - t0, totalDays, startDayOfYear: startDoy, phenology };

  function runStrategy(strategy: StrategyInput): StrategyResult {
    const levers: (LeverConfig | null)[] = parcels.map(p => (strategy.isBaseline ? null : strategy.leversByParcel[p.id] ?? null));
    const cellLever: (LeverConfig | null)[] = new Array(NC);
    for (let c = 0; c < NC; c++) cellLever[c] = cellParcel[c] >= 0 ? levers[cellParcel[c]] : null;
    const attr = new Float64Array(NC);
    const netNow = new Float64Array(NC);
    const kind = new Int8Array(NC); // 0 neutre, 1 forêt, 2 cerisier
    const ver = new Int16Array(NC), har = new Int16Array(NC);
    const netE = new Float32Array(NC), netD = new Int16Array(NC);
    const tisF = new Float32Array(NC).fill(1);
    const residAfter = new Float32Array(NC);
    const larvS = new Float32Array(NC).fill(0.3);
    for (let c = 0; c < NC; c++) {
      const t = grid[c];
      const l = cellLever[c];
      kind[c] = t === 'forest' ? 1 : isCherry(t) ? 2 : 0;
      if (kind[c] === 2) {
        ver[c] = PHENOLOGY[t].veraison; har[c] = PHENOLOGY[t].harvest;
        if (l?.netting) { netE[c] = l.netType === 'monorang' ? 0.95 : 0.85; netD[c] = l.netDeploy === 'bloom' ? 105 : ver[c] - 5; }
        const hr = l?.prophylaxis ? l.harvestRate / 100 : 0.8;
        residAfter[c] = (1 - hr) * (l?.prophylaxis && l.groundFruitDestruction ? 0.25 : 1);
      }
      if (l?.tis) tisF[c] = 1 / (1 + l.tisRatio * 0.12);
    }
    const updateLarvalSurvival = (seasonYears: number) => {
      for (let c = 0; c < NC; c++) {
        const l = cellLever[c];
        let s = 0.3;
        if (l?.parasitoids) {
          const install = Math.min(1, 0.35 + 0.33 * seasonYears);
          const dose = l.parasitoidDose === 'reinforced' ? 1.4 : 1;
          s *= 1 - Math.min(0.75, 0.38 * install * dose);
        }
        larvS[c] = s;
      }
    };
    let lastSeasonYears = -1;

    // États
    const A = new Float64Array(NC);   // femelles adultes / cellule
    const L = new Float64Array(NC);   // immatures (œufs+larves+pupes)
    const nextA = new Float64Array(NC);
    const healthy = new Float32Array(NC).fill(1); // fraction de fruits sains (année en cours)
    const residual = new Float32Array(NC);        // fruits résiduels post-récolte
    const peak = new Float32Array(NC);
    const lastTreat = new Int32Array(parcels.length).fill(-999);
    const treatCount = new Int32Array(parcels.length);
    const treatRemain = new Int32Array(parcels.length);
    const treatKill = new Float32Array(parcels.length);

    for (let c = 0; c < NC; c++) {
      if (grid[c] === 'forest') A[c] = params.startSeason === 'autumn' ? 30 : 12;
      else if (isCherry(grid[c])) A[c] = 0.05;
    }

    const harvestYear: Record<string, number[]> = {};
    parcels.forEach(p => { if (isCherry(p.type)) harvestYear[p.id] = []; });
    const events: SimEvent[] = [];
    const series: SeriesPoint[] = [];
    const damageSeries: SeriesPoint[] = [];
    let iftTotal = 0;

    const humid = params.climateProfile === 'humid-spring';
    const winterMortExtra = params.climateProfile === 'harsh-winter' ? 0.05 : params.climateProfile === 'mild-winter' ? 0.016 : 0.028;

    // Événements statiques (filets, lâchers)
    for (let y = 0; y < params.durationYears + 1; y++) {
      parcels.forEach((p, pi) => {
        const l = levers[pi];
        if (!l) return;
        const base = y * DAYS - startDoy;
        if (l.netting && isCherry(p.type)) {
          const d = base + (l.netDeploy === 'bloom' ? 105 : PHENOLOGY[p.type].veraison - 5);
          if (d >= 0 && d < totalDays) events.push({ day: d, type: 'net', parcelId: p.id });
        }
        if (l.parasitoids) {
          const d = base + (l.parasitoidSeason === 'spring' ? 100 : 280);
          if (d >= 0 && d < totalDays) events.push({ day: d, type: 'parasitoid', parcelId: p.id });
        }
        if (l.tis) {
          const d = base + 80;
          if (d >= 0 && d < totalDays) events.push({ day: d, type: 'tis', parcelId: p.id });
        }
      });
    }

    for (let day = 0; day < totalDays; day++) {
      const doy = (startDoy + day) % DAYS;
      const yearIdx = Math.floor((startDoy + day) / DAYS); // 0-based année calendaire depuis le départ
      const T = temperature(doy, params.climateProfile);
      const suit = tempSuitability(T);
      const dev = Math.max(0, T - 8) / 210; // ~210 degrés-jours œuf→adulte
      const wild = wildResource(doy);
      const seasonYears = Math.max(0, yearIdx - (params.startSeason === 'autumn' ? 1 : 0));
      if (seasonYears !== lastSeasonYears) { updateLarvalSurvival(seasonYears); lastSeasonYears = seasonYears; }

      // Nouvelle année : réinitialisation des fruits sains et compteurs
      if (doy === 0) {
        healthy.fill(1);
        treatCount.fill(0);
      }

      // Déclenchement des traitements par parcelle
      parcels.forEach((p, pi) => {
        const l = levers[pi];
        if (!l || !l.treatment || !isCherry(p.type)) return;
        const ph = PHENOLOGY[p.type];
        if (doy < ph.veraison - 3 || doy > ph.harvest - 3) return; // DAR
        if (treatCount[pi] >= l.treatmentPasses || day - lastTreat[pi] < 7) return;
        let trigger = false;
        if (l.treatmentTrigger === 'calendar') {
          const span = ph.harvest - 3 - ph.veraison;
          const slot = ph.veraison + Math.round((span * treatCount[pi]) / l.treatmentPasses);
          trigger = doy >= slot;
        } else {
          let s = 0; p.cells.forEach(c => (s += A[c]));
          trigger = (s / p.cells.length) * (10000 / eco.cellAreaM2) > 1500; // seuil de piégeage 1 500 femelles/ha
        }
        if (trigger) {
          lastTreat[pi] = day;
          treatCount[pi]++;
          const conv = l.treatmentMode === 'conventional';
          treatRemain[pi] = Math.round((conv ? 7 : 4) * (humid ? 0.6 : 1));
          treatKill[pi] = conv ? 0.32 : 0.16;
          if (conv) iftTotal += p.cells.length;
          events.push({ day, type: 'treatment', parcelId: p.id });
        }
      });

      // Pré-calcul journalier (cellules) — boucle chaude 100 % numérique
      const toHaD = 10000 / eco.cellAreaM2;
      void toHaD;
      for (let c = 0; c < NC; c++) {
        const k = kind[c];
        let at = 0.15, ne = 0;
        if (k === 1) at = 0.6 + wild;
        else if (k === 2) {
          const v = ver[c], h = har[c];
          if (doy >= v - 5 && doy < h) at = 3;
          else if (doy > h) at = 0.3 + residual[c] * 3;
          else at = 0.25;
          if (netE[c] > 0 && doy >= netD[c] && doy <= h + 5) ne = netE[c];
        }
        attr[c] = at; netNow[c] = ne;
      }
      const tisOn = doy >= 80 && doy <= 260;
      const humidF = humid ? 1.25 : 1;
      const larvMort = T < 5 ? 0.03 : 0.012;
      const devC = dev > 1 ? 1 : dev;
      let baseMort = 0.028;
      if (T > 30) baseMort += 0.035;
      const cold = T < 6;

      // 1) Dynamique locale
      for (let c = 0; c < NC; c++) {
        const k = kind[c];
        if (k === 0 && A[c] < 1e-6 && L[c] < 1e-6) { A[c] = 0; L[c] = 0; continue; }
        let a = A[c];
        let larvae = L[c];
        let res = 0.003, fruit = false, K = 8;
        if (k === 1) { res = wild; K = 260; }
        else if (k === 2) {
          K = 700;
          const v = ver[c], h = har[c];
          if (doy >= v && doy < h) { res = 1; fruit = true; }
          else if (doy === h) residual[c] = residAfter[c];
          if (doy > h) { residual[c] *= 0.965; res = residual[c] * 1.4 + 0.02; }
          else if (doy < v) res = 0.02;
        }
        const dd = a < K ? 1 - a / K : 0;
        const eggs = a * 6 * suit * res * (1 - netNow[c]) * (tisOn ? tisF[c] : 1) * dd * humidF;
        if (fruit && eggs > 0) healthy[c] *= Math.exp(-eggs / 3500);
        larvae += eggs * larvS[c];
        const emerge = larvae * devC;
        larvae = larvae - emerge - larvae * larvMort;
        let mort = baseMort;
        if (cold) mort += winterMortExtra * (k === 1 ? 0.5 : 1);
        if (k === 0) mort += 0.04;
        const pi = cellParcel[c];
        if (pi >= 0 && treatRemain[pi] > 0) mort += treatKill[pi];
        if (mort > 0.95) mort = 0.95;
        a = a * (1 - mort) + emerge;
        if (a > K * 1.3) a = K * 1.3;
        A[c] = a > 1e-9 ? a : 0;
        L[c] = larvae > 1e-9 ? larvae : 0;
      }
      for (let pi = 0; pi < parcels.length; pi++) if (treatRemain[pi] > 0) treatRemain[pi]--;

      // 2) Dispersion (attractivité pondérée, filtre des filets)
      nextA.set(A);
      const D = T > 10 ? 0.12 : 0.03;
      for (let c = 0; c < NC; c++) {
        const out = A[c] * D;
        if (out < 1e-4) continue;
        const k0 = nbrStart[c], k1 = nbrStart[c + 1];
        let wsum = 0;
        for (let k = k0; k < k1; k++) wsum += attr[nbr[k]];
        if (wsum <= 0) continue;
        const f = out / wsum;
        let back = -out;
        for (let k = k0; k < k1; k++) {
          const n = nbr[k];
          const share = f * attr[n];
          const block = netNow[n] * 0.7;
          nextA[n] += share - share * block;
          back += share * block; // refoulés par les filets
        }
        nextA[c] += back;
      }
      A.set(nextA);

      // pics
      const toHa = 10000 / eco.cellAreaM2;
      for (let c = 0; c < NC; c++) { const d = A[c] * toHa; if (d > peak[c]) peak[c] = d; }

      // récoltes
      parcels.forEach(p => {
        if (!isCherry(p.type)) return;
        if (doy === PHENOLOGY[p.type].harvest) {
          let h = 0; p.cells.forEach(c => (h += healthy[c]));
          harvestYear[p.id].push((h / p.cells.length) * 100);
          events.push({ day, type: 'harvest', parcelId: p.id });
        }
      });

      // échantillonnage tous les 3 jours
      if (day % 3 === 0 || day === totalDays - 1) {
        const { label } = dayLabel(day, startDoy);
        const yr = Math.floor((startDoy + day) / DAYS) + 1;
        const pt: SeriesPoint = { day, label: `${label} A${yr}` };
        const dp: SeriesPoint = { day, label: `${label} A${yr}` };
        let fs = 0, fn = 0;
        parcels.forEach(p => {
          let s = 0, h = 0;
          for (const c of p.cells) { s += A[c]; h += healthy[c]; }
          pt[p.id] = Math.round((s / p.cells.length) * toHa);
          if (isCherry(p.type)) dp[p.id] = Math.round((h / p.cells.length) * 1000) / 10;
          if (p.type === 'forest') { fs += s; fn += p.cells.length; }
        });
        pt.forest_all = fn ? Math.round((fs / fn) * toHa) : 0;
        let cs = 0, cn = 0;
        parcels.forEach(p => { if (isCherry(p.type)) for (const c of p.cells) { cs += A[c]; cn++; } });
        pt.cherry_all = cn ? Math.round((cs / cn) * toHa) : 0;
        series.push(pt);
        damageSeries.push(dp);
      }
    }

    // ------------------------------------------------- Agrégats technico-éco
    const haPerCell = eco.cellAreaM2 / 10000;
    const harvestByParcel: Record<string, number> = {};
    let wsum = 0, wh = 0, revenue = 0, peakDensity = 0;
    parcels.forEach(p => {
      if (!isCherry(p.type)) return;
      const arr = harvestYear[p.id];
      const v = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 100;
      harvestByParcel[p.id] = Math.round(v * 10) / 10;
      wsum += p.cells.length; wh += v * p.cells.length;
      revenue += p.cells.length * haPerCell * eco.yieldTPerHa * 1000 * eco.pricePerKg * (v / 100);
      for (const c of p.cells) if (peak[c] > peakDensity) peakDensity = peak[c];
    });

    const costs: CostBreakdown = { net: 0, phyto: 0, labor: 0, bio: 0, tis: 0 };
    let laborHours = 0;
    const years = Math.max(1, params.durationYears);
    const K$ = { ...defaultCosts, ...(eco.costs ?? {}) };
    parcels.forEach((p, pi) => {
      const l = levers[pi];
      if (!l) return;
      const ha = p.cells.length * haPerCell;
      if (isCherry(p.type)) {
        if (l.netting) { costs.net += ha * (l.netType === 'monorang' ? K$.netMonorang : K$.netMonoparcelle); laborHours += ha * 40; costs.labor += ha * 40 * K$.laborHour; }
        if (l.prophylaxis) {
          const h = ha * (l.harvestRate >= 95 ? 90 : 55) + (l.groundFruitDestruction ? ha * 25 : 0);
          laborHours += h; costs.labor += h * K$.laborHour;
        }
        if (l.treatment) {
          const passes = l.treatmentPasses;
          costs.phyto += ha * passes * (l.treatmentMode === 'conventional' ? K$.phytoConv : K$.phytoBio);
          laborHours += ha * passes * 1.5; costs.labor += ha * passes * 1.5 * K$.laborHour;
        }
        if (l.tis) costs.tis += ha * K$.tis;
      }
      if (l.parasitoids) costs.bio += ha * (l.parasitoidDose === 'reinforced' ? K$.parasitoidReinf : K$.parasitoidStd);
    });
    // coût annuel moyen (les traitements sont comptés réellement)
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
      costs, totalCost: Math.round(totalCost),
      revenue: Math.round(revenue),
      laborHours: Math.round(laborHours),
      events: events.sort((a, b) => a.day - b.day),
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

export function detectParcels(grid: CellType[]): ParcelInfo[] {
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
