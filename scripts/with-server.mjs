// Démarre le serveur de production sur un port libre, exécute un script, puis l'arrête.
//   node scripts/with-server.mjs scripts/test-e2e.mjs
// Le build doit exister (npm run build). Variable : PORT (défaut 3100).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const script = process.argv[2];
if (!script) { console.error('Usage : node scripts/with-server.mjs <script>'); process.exit(2); }
if (!fs.existsSync('.next/BUILD_ID')) { console.error('✗ Aucun build trouvé : lancez d’abord « npm run build ».'); process.exit(2); }

const port = process.env.PORT ?? '3100';
const url = `http://localhost:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', port], { stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', d => (log += d)); server.stderr.on('data', d => (log += d));
const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
process.on('SIGINT', () => { stop(); process.exit(130); });

const deadline = Date.now() + 30_000;
while (true) {
  try { if ((await fetch(url)).ok) break; } catch { /* pas encore prêt */ }
  if (Date.now() > deadline || server.exitCode !== null) { stop(); console.error(`✗ Le serveur n’a pas démarré sur ${url}\n${log}`); process.exit(1); }
  await new Promise(r => setTimeout(r, 300));
}

const child = spawn(process.execPath, [script, ...process.argv.slice(3)], { stdio: 'inherit', env: { ...process.env, BASE_URL: url } });
child.on('exit', code => { stop(); process.exit(code ?? 1); });
