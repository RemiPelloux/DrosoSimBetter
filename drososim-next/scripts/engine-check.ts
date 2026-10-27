import { simulate, detectParcels, defaultLeverConfig, type CellType } from '../src/lib/engine.ts';
const eco={yieldTPerHa:10,pricePerKg:3.5,cellAreaM2:100};
const grids: Record<string, CellType[]> = { empty: Array(400).fill('neutral'), forestOnly: Array(400).fill('forest') };
const g: CellType[] = Array(400).fill('neutral'); for(let i=0;i<60;i++) g[i]='forest'; for(let y=5;y<15;y++) for(let x=0;x<20;x++) g[y*20+x]= x<7?'early-cherry':x<14?'season-cherry':'late-cherry';
grids.mixed=g;
let bad=0;
for (const [n,gr] of Object.entries(grids)) for (const season of ['spring','autumn'] as const) for (const cl of ['mild-winter','harsh-winter','humid-spring','dry-summer'] as const) for (const y of [1,3]) {
  const P=detectParcels(gr);
  const lv=Object.fromEntries(P.map(p=>[p.id,{...defaultLeverConfig,treatment:true,treatmentTrigger:'threshold' as const,parasitoids:true}]));
  const o=simulate(gr,P,[{id:'b',name:'b',isBaseline:true,leversByParcel:{}},{id:'s',name:'s',isBaseline:false,leversByParcel:lv}],{startSeason:season,durationYears:y,climateProfile:cl},eco);
  const s=JSON.stringify(o.results.map(r=>[r.globalHarvest,r.peakDensity,r.ift,r.totalCost,r.revenue]));
  const years=Object.values(o.results[0].harvestByParcelYear).map(a=>a.length);
  if (s.includes('null')||s.includes('NaN')) { bad++; console.log('NaN',n,season,cl,y); }
  if (n==='mixed' && y===3) console.log(n,season,cl,'harvests/yr',years[0],'base',o.results[0].globalHarvest,'strat',o.results[1].globalHarvest,'ms',o.computeMs.toFixed(0));
}
console.log('bad',bad);
