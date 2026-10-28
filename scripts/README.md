# Scripts

| Script | Commande | Rôle |
|---|---|---|
| [`test-engine.ts`](test-engine.ts) | `npm run test:engine` | tests du moteur sans navigateur : 48 scénarios sans NaN, une récolte par an, bornes, déterminisme, cohérence agronomique, budget de temps |
| [`test-e2e.mjs`](test-e2e.mjs) | `npm run test:e2e` | parcours navigateur : accueil, visite guidée, dessin, annulation, gomme, menu, leviers, partage, résultats, mobile, erreurs console |
| [`docs-media.mjs`](docs-media.mjs) | `npm run docs:media` | régénère les captures, `demo.mp4` et `demo.gif` de `docs/assets/` |
| [`with-server.mjs`](with-server.mjs) | utilisé par les commandes ci-dessus | démarre `next start` sur le port 3100, exécute un script, puis arrête le serveur |
| [`lib/harness.mjs`](lib/harness.mjs) | — | utilitaires partagés : Chromium, assertions ✓/✗, code de sortie |
| [`fix-node-mac.sh`](fix-node-mac.sh) | `bash scripts/fix-node-mac.sh` | répare Node.js sur macOS via nvm (keg Homebrew cassé, `PATH` mort, conda) — voir plus bas |

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

## Réparer Node.js sur macOS — `fix-node-mac.sh`

Pour une machine macOS où `npm run dev` échoue sur le moteur `node` : keg Homebrew cassé (`/opt/homebrew/opt/node@20/bin/node: No such file or directory`), `PATH` mort dans `~/.zshrc`, ou terminal en `(base)` conda. Le script installe Node via **nvm** et neutralise les conflits.

```bash
bash scripts/fix-node-mac.sh --dry-run    # diagnostic seul, n'écrit rien
bash scripts/fix-node-mac.sh              # répare (ne supprime rien)
bash scripts/fix-node-mac.sh --node 22    # force la version par défaut
bash scripts/fix-node-mac.sh --remove-brew-node   # + désinstalle node* de Homebrew
```

| | |
|---|---|
| **Écrit** | bloc nvm géré en fin de `~/.zshrc`, lignes `PATH` mortes commentées, `~/.nvm`, `~/mac-dev-cleanup-<date>/` (rapport, journaux, sauvegardes) |
| **Ne touche pas** | environnements conda, formules Homebrew, projets, `node_modules` |
| **Version choisie** | Node 24 si macOS ≥ 13.5, sinon Node 22 (`--node` pour forcer) |
| **Vérifie** | `node -v` ici **et** dans un shell `zsh -lic` neuf, avec un délai maximum de 25 s |
| **Restauration** | `cp -p ~/mac-dev-cleanup-<date>/backups/.zshrc ~/.zshrc` |

macOS uniquement, bash 3.2 (celui du système), aucune dépendance hors `curl`/`brew`/`conda` déjà présents.
