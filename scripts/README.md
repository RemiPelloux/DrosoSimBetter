# Scripts

| Script | Commande | Rôle |
|---|---|---|
| [`test-engine.ts`](test-engine.ts) | `npm run test:engine` | tests du moteur sans navigateur : 48 scénarios sans NaN, une récolte par an, bornes, déterminisme, cohérence agronomique, budget de temps |
| [`test-e2e.mjs`](test-e2e.mjs) | `npm run test:e2e` | parcours navigateur : accueil, visite guidée, dessin, annulation, gomme, menu, leviers, partage, résultats, mobile, erreurs console |
| [`docs-media.mjs`](docs-media.mjs) | `npm run docs:media` | régénère les captures, `demo.mp4` et `demo.gif` de `docs/assets/` |
| [`with-server.mjs`](with-server.mjs) | utilisé par les commandes ci-dessus | démarre `next start` sur le port 3100, exécute un script, puis arrête le serveur |
| [`lib/harness.mjs`](lib/harness.mjs) | — | utilitaires partagés : Chromium, assertions ✓/✗, code de sortie |
| [`fix-node-mac.sh`](fix-node-mac.sh) | `bash scripts/fix-node-mac.sh` | docteur macOS : répare Node (nvm), conda, Homebrew et les modules natifs, et écrit un rapport dans `~/mac-dev-cleanup-<date>/` — voir plus bas |

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

## Réparer l'environnement de dev macOS — `fix-node-mac.sh`

Docteur + réparateur pour un Mac où Node, conda ou Homebrew sont cassés. Cas réels traités :

| Symptôme | Cause traitée |
|---|---|
| `/opt/homebrew/opt/node@20/bin/node: No such file or directory` | keg Homebrew incomplet + ligne `PATH` morte dans `~/.zshrc` (commentée, après sauvegarde) |
| `node: command not found` mais `nvm` installé | bloc nvm absent ou placé avant `conda initialize` |
| `(base)` dans chaque terminal, `python`/`node` imprévisibles | `auto_activate_base true`, `conda init` manquant, plusieurs conda installés |
| `sqlite incompatible` côté Python | `libsqlite3.dylib` absente de la base conda (`conda install -n base sqlite`) |
| `NODE_MODULE_VERSION 115 … requires 137` | modules natifs (`better-sqlite3`, `sqlite3`, `sharp`, `esbuild`…) compilés pour l'ancienne version de Node |
| `dyld: Library not loaded: …libsqlite3.dylib` | `sqlite` de Homebrew incomplet, `DYLD_LIBRARY_PATH` pollué par conda |

```bash
bash scripts/fix-node-mac.sh --dry-run                 # diagnostic seul (écrit le rapport)
bash scripts/fix-node-mac.sh                           # répare ce qui est sûr
bash scripts/fix-node-mac.sh --fix-brew                # + brew reinstall sqlite, kegs node*
bash scripts/fix-node-mac.sh --fix-native              # + reconstruit les modules natifs
bash scripts/fix-node-mac.sh --node 22                 # force la version Node par défaut
bash scripts/fix-node-mac.sh --scan ~/dev --scan ~/Projects   # où chercher d'autres projets
bash scripts/fix-node-mac.sh --remove-brew-node        # désinstalle node* de Homebrew
```

**Automatique** : conda `auto_activate_base false`, `conda init zsh` si absent, `conda clean --all`, `conda install -n base sqlite` si `import sqlite3` échoue, `brew cleanup`, nvm + Node 22 (ou 24 si macOS ≥ 13.5), lignes `PATH` mortes commentées, `npm cache verify`.

**Jamais automatique** : suppression d'un environnement conda, d'une formule Homebrew (`--remove-brew-node`), reconstruction de `node_modules` (`--fix-native`).

**Rapport** — tout est écrit dans `~/mac-dev-cleanup-<date>/` :

| Fichier | Contenu |
|---|---|
| `report.md` | bilan lisible : compteurs OK / gênant / cassé / corrigé, journal, actions |
| `problems.txt` | journal machine `[OK\|WARN\|BROKEN\|FIXED] ID message → remède` |
| `actions.txt` | ce qui a été réellement modifié |
| `before.txt` / `after.txt` | état Node/npm/conda/brew avant et après |
| `brew-doctor.txt`, `conda-*.txt`, `native-*.log`, `zsh-neuf.txt` | sorties brutes des outils |
| `backups/` | copies de `~/.zshrc`, `~/.zprofile`, `~/.npmrc`, `~/.condarc`… (restauration : `cp -p ~/mac-dev-cleanup-<date>/backups/.zshrc ~/.zshrc`) |

Sort en code 1 s'il reste des points `BROKEN` : il suffit d'envoyer `report.md` pour obtenir un diagnostic à distance. macOS uniquement (bash 3.2 du système) ; un seul cas d'usage hors macOS, les tests internes : `FIXNODE_ALLOW_NON_MACOS=1`.
