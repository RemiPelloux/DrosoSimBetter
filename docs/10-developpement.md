---
title: Modifier le code
icon: code
---

# Guide du développeur : modifier le code

## 1. Démarrer

```bash
git clone https://github.com/RemiPelloux/DrosoSimBetter.git && cd DrosoSimBetter
npm install
npm run dev          # http://localhost:3000, rechargement à chaud
```

Prérequis : **Node.js ≥ 22** (fichier `.nvmrc` fourni : `nvm use`) et npm. Copiez `.env.example` en `.env.local` pour configurer un backend de simulation.

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (rechargement à chaud) |
| `npm run build` puis `npm start` | build de production puis serveur (port 3000) |
| `npm run lint` | ESLint sur tout le dépôt |
| `npm run typecheck` | types de routes (`next typegen`) puis vérification TypeScript |
| `npm run check` | lint + typage + tests du moteur : **à lancer avant chaque commit** |
| `npm run test:engine` | tests du moteur (25 vérifications, sans navigateur) |
| `npm run test:e2e` | parcours navigateur (16 vérifications ; build et Chromium requis) |
| `npm test` | tous les tests |
| `npm run docs:media` | régénère captures, démo GIF et MP4 du README (ffmpeg et ImageMagick requis) |
| `npm run backend:node` / `backend:python` | backends d'exemple sur les ports 8787 / 8788 |

Détails et variables d'environnement des scripts : [`scripts/README.md`](../scripts/README.md).

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
| `docs/*.md` | cette documentation (rendue sur `/docs` ; seuls les fichiers numérotés sont des chapitres) | documenter vos changements |
| `scripts/` | tests et génération des médias | ajouter une vérification |
| `examples/` | backends d'exemple et requête de test | partir d'un squelette de backend |

## 3. Recettes courantes

### Changer un paramètre biologique

Tous les paramètres sont regroupés dans l'objet `PARAMS` de `src/lib/engine.ts` :

```ts
export const PARAMS = {
  fecundity: 8,            // œufs / femelle / jour à l'optimum
  eggSurvival: 0.30,       // fraction d'œufs viables
  adultMort: 0.028,        // mortalité adulte journalière
  K: { forest: 260, cherry: 700, neutral: 8 },
  damageConst: 3500,       // constante de dégâts
  dispersalWarm: 0.12,     // fraction dispersée par jour si T > 10 °C
  …
};
```

Ils peuvent aussi être modifiés **à l'exécution** (script de calibration, exploration de sensibilité) : `PARAMS.fecundity = 9`, puis `resetClimateCache()` si un paramètre climatique a changé. Après modification, lancez `npm run test:engine` : les vérifications de cohérence agronomique signalent une régression. Pensez à mettre à jour `docs/03-modele.md` et la table maître de `docs/11-modele-mathematique.md`.

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
2. **Effet** : dans `runStrategy`, précalculez un tableau par case (à côté de `netE`, `tisF`, `paraOn`…) et appliquez-le dans la passe locale, par exemple comme mortalité adulte additionnelle :
   ```ts
   const trapK = new Float32Array(NC);           // alloué une fois dans simulate(), rempli par stratégie
   // … pour chaque case : if (l?.trap) trapK[c] = 0.004 * (l.trapDensity / 100);
   mort += trapK[c];                             // dans la section « adultes » de la boucle
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

Importez le dépôt tel quel (le projet est à la racine). Ajoutez au besoin les variables `NEXT_PUBLIC_SIM_BACKEND` et `NEXT_PUBLIC_SIM_BACKEND_URL`.

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
