// Serveur de production minimal pour le build Angular (dist/browser) :
// fichiers statiques, repli sur index.html pour les routes de l'application,
// en-têtes de sécurité et cache des logos partenaires.
//   npm start            → http://localhost:3000   (PORT pour changer le port)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.DIST_DIR ?? 'dist/browser');
const PORT = Number(process.env.PORT ?? 3000);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.error(`✗ Aucun build trouvé dans ${ROOT} : lancez d’abord « npm run build ».`); process.exit(2); }

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(ROOT, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  const asset = /\.[a-z0-9]+$/i.test(url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (asset) { res.writeHead(404, { ...SECURITY, 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable'); return; }
    file = path.join(ROOT, 'index.html'); // route de l'application : le routeur Angular prend le relais
  }
  const ext = path.extname(file);
  const cache = url.startsWith('/partners/') ? 'public, max-age=604800, stale-while-revalidate=86400'
    : url.startsWith('/docs-assets/') ? 'public, max-age=86400'
    : /-[A-Z0-9]{8}\.(js|css)$/.test(file) ? 'public, max-age=31536000, immutable'
    : 'no-cache';
  res.writeHead(200, { ...SECURITY, 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': cache });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`DrosoSim Next → http://localhost:${PORT}`));
