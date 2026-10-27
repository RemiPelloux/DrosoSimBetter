---
title: Architecture technique
icon: cpu
---

# Architecture technique

## 1. Pile technologique

| Couche | Choix | Raison |
|---|---|---|
| Framework | **Next.js 16** (App Router) + **React 19** + **TypeScript** | pages statiques, hébergeables sur n'importe quel CDN ou VPS |
| Style | **Tailwind CSS 4**, palette haute luminosité (Slate-50 / blanc / Slate-200) | lisible en plein soleil sur tablette |
| Animations | **Framer Motion** | transitions, onboarding, illustrations SVG animées |
| État | **Zustand** + **zundo** (historique) + `persist` (localStorage) | annuler/rétablir natif, sauvegarde automatique |
| Graphiques | **Recharts 3** | `ReferenceArea` / `ReferenceLine` pour la phénologie et les interventions |
| Calcul | **TypeScript pur dans un Web Worker** | aucun serveur, calcul hors du fil d'affichage |
| Partage | **lz-string** + encodage RLE de la grille | liens d'environ 1,5 ko |
| Documentation | **react-markdown**, **KaTeX** | formules mathématiques rendues dans l'application |

L'application est **100 % côté client** : aucune donnée ne quitte le navigateur, sauf si l'utilisateur partage un lien ou un fichier.

## 2. Arborescence

```
src/
├── app/
│   ├── page.tsx             Accueil (hero animé, démo, personas)
│   ├── simulator/page.tsx   Cockpit : éditeur | paramètres & leviers | aperçu temps réel
│   ├── results/page.tsx     Résultats, comparateur, Fiche Conseil
│   └── docs/                Cette documentation
├── components/
│   ├── GridEditor.tsx       Éditeur 20×20 (outils, menu, plein écran, mini-cartes)
│   ├── ControlPanel.tsx     Paramètres, stratégies, matrice des leviers, coûts
│   ├── charts.tsx           Tous les graphiques
│   ├── AppHeader.tsx        En-tête, raccourcis globaux, toasts, partage
│   └── illustrations.tsx    SVG sur mesure (drosophile, logo, schémas)
├── lib/
│   ├── engine.ts            Moteur de simulation (pur, sans dépendance)
│   ├── backend.ts           Contrat + backends (local, HTTP, WebSocket)
│   ├── projectIO.ts         Import / export universel (JSON, .drososim, PNG, CSV, TXT)
│   ├── sim.worker.ts        Enveloppe Web Worker
│   ├── useSimulation.ts     Hook temps réel
│   └── store.ts             État global, historique, persistance, partage
docs/                        Sources Markdown de la documentation (+ assets/ : médias du README)
examples/                    backend-node (référence), backend-python (squelette + FastAPI), requete-exemple.json
scripts/                     test-engine.ts, test-e2e.mjs, docs-media.mjs, with-server.mjs, lib/harness.mjs
```

## 3. Le moteur (`engine.ts`)

La fonction `simulate(grid, parcels, strategies, params, economics)` renvoie, pour chaque stratégie, les séries, les récoltes, les coûts et les événements.

**Optimisations** (environ 20 ms par stratégie pour 3 ans sur un processeur portable récent) :
- tableaux typés (`Float64Array`, `Int8Array`…) pré-alloués, **aucune allocation dans la boucle chaude** ;
- tout ce qui ne change pas pendant la simulation (type de case, dates de véraison et de récolte, paramètres des leviers) est **pré-calculé en tableaux numériques**, pour qu'aucune chaîne de caractères ni aucun objet ne soit lu dans la boucle ;
- voisinage de Moore stocké en **tableau plat** (CSR) ;
- attractivité et filets calculés **une fois par jour et par case**, puis réutilisés pour les 8 voisines ;
- valeurs inférieures à $10^{-9}$ remises à zéro, pour éviter les nombres dénormalisés qui ralentissent fortement les calculs flottants ;
- séries échantillonnées **tous les 3 jours** (environ 365 points pour 3 ans).

## 4. Calcul temps réel

`useSimulation()` observe la grille, les stratégies, les paramètres et l'économie. À chaque changement :
1. un **délai de 60 ms** (350 ms pour un backend distant) regroupe les modifications rapides (un glissement de curseur, par exemple) ;
2. la requête est envoyée au **backend configuré** (Web Worker local par défaut, ou serveur HTTP / WebSocket — voir *Brancher son backend*), avec un numéro de séquence ;
3. seule la **dernière réponse** est prise en compte, pour qu'aucun résultat périmé ne s'affiche ;
4. renommer une parcelle **ne relance pas** le calcul (les noms n'influent pas sur le modèle).

## 5. État et historique

- `zundo` conserve les **50 derniers états** de la partie « métier » (grille, noms, stratégies, paramètres, économie). Les changements d'outil, de mise en page ou de sélection ne polluent pas l'historique.
- Un **geste de dessin complet** (trait, rectangle, remplissage) produit **une seule entrée** : le trait est d'abord prévisualisé localement, puis enregistré en une fois au relâchement.
- `persist` enregistre le projet et les préférences d'interface (disposition des colonnes, taille du pinceau, onboarding) sous la clé `drososim-next-v2`.

## 6. Formats d'échange

**Projet JSON** (`Sauvegarder` / `Importer`) :
```json
{ "app": "drososim-next", "version": 2, "savedAt": "…",
  "grid": ["neutral", "forest", "…400 cases…"],
  "parcelNames": { "late-cherry-1": "Haut – Regina" },
  "strategies": [{ "id": "…", "name": "…", "isBaseline": false, "color": "#2563EB",
                   "leversByParcel": { "late-cherry-1": { "netting": true, "netType": "monorang", "…": "…" } } }],
  "activeStrategyId": "…", "simParams": { "…": "…" }, "economics": { "…": "…", "costs": { "…": "…" } } }
```
Les leviers incomplets (anciennes versions) sont complétés avec les valeurs par défaut au chargement.

**Lien de partage** : `?sim=` suivi du projet sérialisé, avec la grille encodée en *run-length* (`60f40n7e…`), le tout compressé par `LZString.compressToEncodedURIComponent`.

**CSV** : une ligne tous les 3 jours, une colonne par couple (stratégie × parcelle × indicateur), puis un bloc de synthèse.

## 7. Qualité

| Commande | Vérifie |
|---|---|
| `npm run lint` | ESLint sur tout le dépôt (règles React 19 / Next) |
| `npm run typecheck` | génération des types de routes (`next typegen`) puis typage strict |
| `npm run test:engine` | 12 vérifications : 48 scénarios sans NaN (grilles vide / forêt / mixte × saisons × climats × durées), une récolte par an, bornes, déterminisme, cohérence agronomique, budget de temps |
| `npm run test:e2e` | 16 vérifications dans Chromium : accueil, visite guidée, dessin interpolé, annulation d'un trait entier, gomme, menu d'édition, leviers, lien de partage rejoué dans un navigateur vierge, résultats, mobile, zéro erreur console. Le serveur de production est démarré puis arrêté automatiquement. |
| `npm run check` | lint + typage + tests du moteur (rapide, sans navigateur) |
| `npm test` | tests du moteur + parcours navigateur |

Tous les tests sortent avec le code 1 en cas d'échec ; voir [`scripts/README.md`](../scripts/README.md).

## 8. Déploiement

```bash
npm ci && npm run build && npm start      # serveur Node (port 3000)
```
Les trois pages sont pré-rendues statiquement. Derrière un reverse proxy (Caddy, Nginx), HTTP/3 et la compression Brotli/Zstd suffisent. Aucune base de données n'est nécessaire.
