// Build de production Angular avec la configuration du backend de simulation.
//   npm run build        (lit .env.local puis .env, et les variables d'environnement)
// Variables : SIM_BACKEND (local | http | ws) et SIM_BACKEND_URL — injectées au build
// via « ng build --define ». Les anciens noms NEXT_PUBLIC_SIM_BACKEND(_URL) restent acceptés.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
for (const f of ['.env', '.env.local'].reverse()) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const backend = env.SIM_BACKEND ?? env.NEXT_PUBLIC_SIM_BACKEND ?? 'local';
const url = env.SIM_BACKEND_URL ?? env.NEXT_PUBLIC_SIM_BACKEND_URL ?? '';
const args = ['ng', 'build', '--define', `SIM_BACKEND=${JSON.stringify(backend)}`, '--define', `SIM_BACKEND_URL=${JSON.stringify(url)}`, ...process.argv.slice(2)];
const r = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
