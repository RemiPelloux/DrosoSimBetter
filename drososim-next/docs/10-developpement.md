---
title: Modifier le code
icon: code
---

# Guide du développeur : modifier le code

## 1. Démarrer

```bash
git clone <dépôt> && cd drososim-next
npm install
npm run dev          # http://localhost:3000, rechargement à chaud
```

Prérequis : **Node.js ≥ 20** (22+ recommandé, nécessaire pour exécuter les scripts `.ts` sans compilation) et npm.

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` puis `npm start` | build de production puis serveur (port 3000) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | vérification des types |
| `npm run test:engine` | contrôle du moteur (48 scénarios : NaN, saisons, climats, durées) |
| `npm run test:e2e` | parcours navigateur Playwright (serveur sur `:3100` et Chromium requis) |

## 2. Carte du code

| Fichier | Contenu | À modifier pour… |
|---|---|---|
| `src/lib/engine.ts` | modèle biologique, leviers, économie, phénologie, types | changer les équations ou paramètres, ajouter un levier |
| `src/lib/backend.ts` | contrat et backends (local, HTTP, WS) | brancher un modèle externe |
| `src/lib/useSimulation.ts` | relance du calcul à chaque modification | changer le délai, filtrer des stratégies |
| `src/lib/store.ts` | état global (Zustand), historique, persistance, modèles, démo, partage | ajouter un champ au projet, un modèle de verger |
| `src/lib/projectIO.ts` | import/export de tous les formats | ajouter un format |
| `src/components/GridEditor.tsx` | éditeur 20×20 | outils de dessin, palette |
| `src/components/ControlPanel.tsx` | paramètres, stratégies, matrice des leviers, coûts | interface des leviers |
| `src/components/charts.tsx` | graphiques Recharts | ajouter ou modifier un graphique |
| `src/components/art.tsx`, `illustrations.tsx` | SVG artistiques et animations | identité visuelle |
| `src/app/page.tsx` | landing page | contenu marketing |
| `src/app/simulator/page.tsx` | cockpit de simulation | disposition, onboarding |
| `src/app/results/page.tsx` | page de résultats | sections, indicateurs |
| `docs/*.md` | cette documentation (rendue sur `/docs`) | documenter vos changements |

## 3. Recettes courantes

### Changer un paramètre biologique

Tous les paramètres sont dans `src/lib/engine.ts`, dans la fonction `runStrategy` :

```ts
const eggs = a * 6 * suit * res * …           // fécondité maximale (6 œufs/♀/j)
let baseMort = 0.028;                         // mortalité adulte journalière
const larvS = new Float32Array(NC).fill(0.3); // survie larvaire
const D = T > 10 ? 0.12 : 0.03;               // fraction dispersée par jour
healthy[c] *= Math.exp(-eggs / 3500);         // constante de dégâts
```

Après modification, lancez `npm run test:engine` et comparez les sorties. Pensez à mettre à jour `docs/03-modele.md`.

### Changer les dates de maturité

```ts
export const PHENOLOGY = {
  'early-cherry':  { veraison: 130, harvest: 158, label: 'Précoce' },  // jour de l'année
  'season-cherry': { veraison: 150, harvest: 178, label: 'Saison' },
  'late-cherry':   { veraison: 168, harvest: 200, label: 'Tardive' },
};
```

### Ajouter un levier (exemple : « piège de masse »)

1. **Type** : ajoutez les champs dans `LeverConfig` et `defaultLeverConfig` (`engine.ts`) :
   ```ts
   trap: boolean; trapDensity: number;        // dans LeverConfig
   trap: false, trapDensity: 400,             // dans defaultLeverConfig
   ```
2. **Effet** : dans `runStrategy`, précalculez un tableau par case et appliquez-le dans la boucle locale, par exemple comme mortalité adulte additionnelle :
   ```ts
   const trapK = new Float32Array(NC);
   // … pour chaque case : if (l?.trap) trapK[c] = 0.004 * (l.trapDensity / 100);
   mort += trapK[c];
   ```
3. **Coût** : ajoutez le poste dans le calcul des coûts (`costs.bio += …`) et, si besoin, un champ dans `LeverCosts` et `defaultCosts`.
4. **Interface** : ajoutez une entrée dans `LEVERS` (`ControlPanel.tsx`) — libellé, icône Lucide, couleur, parcelles cibles — puis un bloc de réglages dans `AdvancedLevers`.
5. **Événements** (optionnel) : poussez `{ day, type: 'trap', parcelId }` dans `events` et ajoutez une entrée dans `EVENT_META` (`charts.tsx`).
6. **Compatibilité** : les anciens projets restent lisibles, car `loadProject` complète les leviers manquants avec `defaultLeverConfig`.

### Ajouter un type de case (exemple : « fraise »)

1. Ajoutez la valeur dans le type `CellType` et les dictionnaires `TYPE_LABEL`, `TYPE_COLOR` (`engine.ts`).
2. Définissez sa phénologie et son comportement dans la boucle (`kind`, ressource, capacité d'accueil).
3. Ajoutez-la à la palette (`PALETTE`, `SHORT`, `CELL_BG` dans `GridEditor.tsx`).
4. Mettez à jour l'encodage RLE du partage (`CODE` et `DECODE` dans `store.ts`) et les alias d'import (`projectIO.ts`).

### Ajouter un graphique

1. Créez un composant dans `charts.tsx` qui reçoit `out: SimOutput` et les `strategies` (pour les couleurs).
2. Insérez-le dans un chapitre de `src/app/results/page.tsx` à l'intérieur d'un `<Card>`.
3. Utilisez `isAnimationActive={false}` pour garder les mises à jour en temps réel fluides.

### Ajouter un modèle de verger

Dans `store.ts`, ajoutez un cas à `buildTemplate()` et une entrée à `TEMPLATES` dans `GridEditor.tsx`.

### Ajouter un format d'export

Dans `projectIO.ts` : ajoutez un `case` à `exportProject()` qui embarque `projectPayload()` (le projet compressé), puis la détection correspondante dans `importText()` ou `importFile()`. Ajoutez enfin l'entrée dans `EXPORTS` (`AppHeader.tsx`).

## 4. Conventions

- **Langue** : interface et documentation en français ; noms de code en anglais.
- **Moteur pur** : `engine.ts` ne dépend d'aucune bibliothèque, ce qui permet de l'exécuter dans un worker, côté serveur (`examples/backend-node`) ou en test.
- **Historique** : toute modification « métier » (grille, stratégies, paramètres) passe par le store. Pour qu'un geste ne crée qu'une entrée d'annulation, faites une seule mise à jour.
- **Performance** : dans la boucle du moteur, pas d'allocation, pas de chaînes, seulement des tableaux typés précalculés.
- **Styles** : Tailwind CSS ; titres en Fraunces (`font-display`) ; palette agronomique (forêt `#15803D`, précoce `#D97706`, saison `#E11D48`, tardive `#991B1B`).

## 5. Déployer

### Vercel / Netlify

Importez le dépôt, puis indiquez le répertoire `drososim-next` comme racine du projet. Ajoutez au besoin les variables `NEXT_PUBLIC_SIM_BACKEND` et `NEXT_PUBLIC_SIM_BACKEND_URL`.

### VPS avec Caddy

```bash
npm ci && npm run build
PORT=3000 npm start          # à superviser avec systemd ou pm2
```

```caddyfile
drososim.mon-domaine.fr {
    encode zstd gzip
    reverse_proxy localhost:3000
}
api.drososim.mon-domaine.fr {
    reverse_proxy localhost:8788     # votre backend de simulation
}
```

Caddy gère automatiquement HTTPS et HTTP/3.
