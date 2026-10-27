# DrosoSim Next

Simulateur temps réel d'aide à la décision contre *Drosophila suzukii* (cerisiers).

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run lint
npm run test:engine  # contrôle du moteur (NaN, climats, départ automne, perfs)
npm run test:e2e     # parcours navigateur (serveur sur :3100, chromium requis)
```

## Parcours
- `/` accueil animé, **Voir une démo** (verger + 3 stratégies pré-remplies)
- `/simulator` éditeur 20×20 · simulation & climat · stratégies & leviers · aperçu temps réel
- `/results` verdict, KPIs côte à côte, 8 graphiques, carte de pression, matrice des leviers, coûts, recommandations, hypothèses, CSV, Fiche Conseil PDF (impression A4)

## Architecture
| Fichier | Rôle |
|---|---|
| `src/lib/engine.ts` | Moteur spatio-temporel journalier (TS pur, tableaux typés). **Une simulation par stratégie** : les leviers modifient réellement la dynamique. ~20 ms / stratégie / 3 ans. |
| `src/lib/sim.worker.ts`, `useSimulation.ts` | Web Worker + hook temps réel (debounce 60 ms, dernière requête gagnante). |
| `src/lib/store.ts` | Zustand + zundo (undo/redo 50 actions, 1 entrée par geste) + persistance localStorage, modèles, démo, JSON, lien de partage compressé (RLE + LZ-string). |
| `src/components/GridEditor.tsx` | Pinceau / zone / remplissage / gomme (clic droit) / édition (changer, scinder, supprimer), tactile, renommage. |
| `src/components/ControlPanel.tsx` | Paramètres, stratégies, matrice des 5 leviers + réglages avancés, « Appliquer à toutes ». |
| `src/components/charts.tsx` | Graphiques Recharts légendés (phénologie, interventions, superposition, économie, radar…). |

Raccourcis : `B R F E V` outils, `1-4` types, `[ ]` taille du pinceau, `Maj+F` éditeur plein écran, `Ctrl+Z/Y`, `Ctrl+S`, `Échap`. Colonnes redimensionnables (poignées, double-clic = réinitialiser, préréglages « Disposition »).

> Modèle pédagogique non calibré sur données terrain : comparer des ordres de grandeur.
