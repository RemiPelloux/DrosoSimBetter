# Documentation de DrosoSim Next

La documentation est aussi consultable **dans l'application**, sur `/docs`, avec les formules et les schémas animés.

| # | Chapitre | Pour qui | Contenu |
|---|---|---|---|
| 1 | [Présentation](01-presentation.md) | tous | objectifs, comparaison avec l'outil existant, personas |
| 2 | [Guide d'utilisation](02-guide.md) | utilisateurs | éditeur, leviers, résultats, sauvegarde et partage, raccourcis |
| 3 | [Le modèle biologique](03-modele.md) | chercheurs | variables d'état, climat, phénologie thermique, équations, paramètres, pas de temps journalier |
| 4 | [Les leviers de lutte](04-leviers.md) | chercheurs, conseillers | formalisation de chaque levier et combinaisons |
| 5 | [Économie & indicateurs](05-economie.md) | conseillers | chiffre d'affaires, coûts, bilan, IFT, radar, recommandations |
| 6 | [Architecture technique](06-architecture.md) | développeurs | pile, moteur, état, formats, qualité |
| 7 | [Limites & calibration](07-limites.md) | chercheurs | hypothèses, bon usage, démarche de calibration |
| 8 | [Analyse du DrosoSim institutionnel](08-drososim-institutionnel.md) | chercheurs | modèle de drososim.fr (code client et publications) |
| 9 | [Brancher son backend](09-backend.md) | développeurs, chercheurs | contrat d'échange, HTTP, WebSocket, exemples |
| 10 | [Modifier le code](10-developpement.md) | développeurs | carte du code, recettes, conventions, déploiement |
| 11 | [Spécification du moteur](11-modele-mathematique.md) | chercheurs, développeurs | toutes les équations, constantes, unités et sorties, pour réimplémenter ou calibrer |

## Organisation du dossier

```
docs/
├── README.md          cet index (non affiché dans l'application)
├── NN-titre.md        un chapitre par fichier, numéroté dans l'ordre de lecture
└── assets/            médias du README et des chapitres (régénérés par npm run docs:media)
```

Pour ajouter un chapitre : créez `12-mon-sujet.md` avec un en-tête `title` / `icon`. Il apparaît automatiquement dans la navigation, sur la page `/docs/mon-sujet`.
