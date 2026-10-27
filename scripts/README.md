# Scripts

| Script | Commande | Rôle |
|---|---|---|
| [`test-engine.ts`](test-engine.ts) | `npm run test:engine` | tests du moteur sans navigateur : 48 scénarios sans NaN, une récolte par an, bornes, déterminisme, cohérence agronomique, budget de temps |
| [`test-e2e.mjs`](test-e2e.mjs) | `npm run test:e2e` | parcours navigateur : accueil, visite guidée, dessin, annulation, gomme, menu, leviers, partage, résultats, mobile, erreurs console |
| [`docs-media.mjs`](docs-media.mjs) | `npm run docs:media` | régénère les captures, `demo.mp4` et `demo.gif` de `docs/assets/` |
| [`with-server.mjs`](with-server.mjs) | utilisé par les commandes ci-dessus | démarre `next start` sur le port 3100, exécute un script, puis arrête le serveur |
| [`lib/harness.mjs`](lib/harness.mjs) | — | utilitaires partagés : Chromium, assertions ✓/✗, code de sortie |

Tous les tests affichent ✓ / ✗ et **sortent avec le code 1 en cas d'échec** (utilisable en intégration continue).

## Variables d'environnement

| Variable | Défaut | Effet |
|---|---|---|
| `BASE_URL` | `http://localhost:3100` | serveur testé (pour viser un serveur déjà lancé : `BASE_URL=http://localhost:3000 node scripts/test-e2e.mjs`) |
| `PORT` | `3100` | port utilisé par `with-server.mjs` |
| `CHROMIUM_PATH` | détection automatique | navigateur à utiliser (sinon : Chromium de Playwright, puis navigateurs système) |
| `SHOTS_DIR` | `.e2e-shots` | dossier des captures du parcours (ignoré par git) |
| `ENGINE_BUDGET_MS` | `600` | budget de temps du test de performance du moteur |
| `MEDIA_OUT` | `docs/assets` | dossier de sortie de `docs:media` |

## Prérequis

- Node.js ≥ 22 (exécution directe des fichiers `.ts`).
- Un build pour les tests navigateur et les médias : `npm run build`.
- Chromium : `npx playwright install chromium` si aucun navigateur n'est installé.
- `docs:media` nécessite aussi `ffmpeg` et ImageMagick (`magick`).
