// =============================================================================
// Backend de référence (Node ≥ 22, aucune dépendance)
// Expose le moteur TypeScript de DrosoSim Next derrière une API HTTP qui
// respecte le contrat de src/lib/backend.ts. Sert d'exemple et de test.
//
//   node examples/backend-node/server.ts            # écoute sur :8787
//   puis ouvrir http://localhost:3000/simulator?backend=http://localhost:8787/simulate
// =============================================================================
import { createServer } from 'node:http';
import { simulate } from '../../src/lib/engine.ts';

const PORT = Number(process.env.PORT ?? 8787);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }); return res.end('{"status":"ok"}'); }
  if (req.method !== 'POST' || !req.url?.startsWith('/simulate')) { res.writeHead(404, CORS); return res.end(); }
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const r = JSON.parse(body);
    if (r.version !== 1) throw new Error(`version de contrat non supportée : ${r.version}`);
    const t0 = performance.now();
    const out = simulate(r.grid, r.parcels, r.strategies, r.params, r.eco);
    const json = JSON.stringify({ ...out, computeMs: performance.now() - t0, results: out.results.map(x => ({ ...x, peakByCell: Array.from(x.peakByCell) })) });
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end(json);
    console.log(`[simulate] ${r.strategies.length} stratégies · ${r.params.durationYears} an(s) · ${(performance.now() - t0).toFixed(0)} ms`);
  } catch (e) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
}).listen(PORT, () => console.log(`Backend DrosoSim (référence) → http://localhost:${PORT}/simulate`));
