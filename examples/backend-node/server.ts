// =============================================================================
// Backend de référence (Node ≥ 22, aucune dépendance)
// Expose le moteur TypeScript de DrosoSim Next derrière une API HTTP qui
// respecte le contrat de src/lib/backend.ts. Sert d'exemple et de test de conformité.
//
//   npm run backend:node                       # ou : node examples/backend-node/server.ts
//   puis http://localhost:3000/simulator?backend=http://localhost:8787/simulate
// =============================================================================
import { createServer } from 'node:http';
import { simulate } from '../../src/lib/engine.ts';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY = 2 * 1024 * 1024; // 2 Mo : une requête réelle fait environ 15 Ko
const CONTRACT_VERSION = 1;
const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (res: import('node:http').ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { status: 'ok', contract: CONTRACT_VERSION });
  if (req.method !== 'POST' || !req.url?.startsWith('/simulate')) return json(res, 404, { error: 'introuvable' });
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BODY) return json(res, 413, { error: 'requête trop volumineuse' });
    }
    const r = JSON.parse(body);
    if (r.version !== CONTRACT_VERSION) throw new Error(`version de contrat non supportée : ${r.version}`);
    if (!Array.isArray(r.grid) || !Array.isArray(r.parcels) || !Array.isArray(r.strategies)) throw new Error('champs grid, parcels et strategies requis');
    const t0 = performance.now();
    const out = simulate(r.grid, r.parcels, r.strategies, r.params, r.eco);
    const computeMs = performance.now() - t0;
    json(res, 200, { ...out, computeMs, results: out.results.map(x => ({ ...x, peakByCell: Array.from(x.peakByCell) })) });
    console.log(`[simulate] ${r.strategies.length} stratégies · ${r.params?.durationYears} an(s) · ${computeMs.toFixed(0)} ms`);
  } catch (e) {
    json(res, 400, { error: (e as Error).message });
  }
}).listen(PORT, () => console.log(`Backend DrosoSim (référence) → http://localhost:${PORT}/simulate`));
