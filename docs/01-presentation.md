---
title: Présentation
icon: book
---

# DrosoSim Next — présentation

**DrosoSim Next** est un simulateur d'aide à la décision pour la protection intégrée des vergers de cerisiers contre ***Drosophila suzukii***, la drosophile à ailes tachetées. Il permet de :

1. **dessiner** un parcellaire (vergers précoces, de saison, tardifs et espaces naturels) sur une grille de 20 × 20 cases ;
2. **combiner** cinq leviers de lutte par parcelle : filet insect-proof, prophylaxie, traitements chimiques ou de biocontrôle, lâchers de parasitoïdes, technique de l'insecte stérile (TIS) ;
3. **simuler** jour par jour la dynamique de la population et les dégâts sur fruits, sur 1 à 3 ans ;
4. **comparer** plusieurs stratégies à un **témoin sans protection** avec des indicateurs techniques (récolte saine, pic de population), économiques (chiffre d'affaires sauvé, coûts, bilan net) et environnementaux (IFT).

> **Statut du modèle.** Le modèle est **pédagogique et qualitatif** : il reproduit les grands mécanismes connus de la biologie de *D. suzukii* (rôle des refuges, sensibilité des variétés tardives, pic estival, rebond post-récolte), mais **ses paramètres ne sont pas calibrés sur des données de terrain**. Il sert à **comparer des stratégies entre elles** et à comprendre *pourquoi* l'une fonctionne mieux qu'une autre, pas à prédire un rendement exact. Voir le chapitre *Limites & calibration*.

## Pourquoi cet outil ?

L'outil institutionnel de référence souffrait de plusieurs freins à l'usage sur le terrain :

| Frein constaté | Réponse de DrosoSim Next |
|---|---|
| Saisie case par case en glisser-déposer | Pinceau (1×1 à 3×3), zone rectangulaire, pot de peinture, modèles prêts à l'emploi |
| Impossible de corriger une erreur | Menu d'édition par case ou par parcelle, gomme au clic droit, historique Ctrl+Z / Ctrl+Y (50 actions) |
| Trois écrans séparés | Un cockpit unique (verger, leviers, aperçu temps réel), colonnes redimensionnables, éditeur plein écran |
| Calcul serveur de ~0,7 s | Calcul local en quelques dizaines de millisecondes, relancé à chaque modification |
| Courbes sans légende | Légendes cliquables, bandes de phénologie, marqueurs d'interventions, infobulles détaillées |
| Aucun indicateur économique | CA sauvé, coûts détaillés et éditables, bilan net, ROI, IFT, radar multicritère |

## Les trois personas

- **L'arboriculteur** : « Le filet sur ma variété tardive est-il rentable face au bois qui borde mon verger ? »
- **Le conseiller technique** : compare deux ou trois scénarios en direct devant un producteur, puis envoie un lien ou une *Fiche Conseil* PDF.
- **L'expérimentateur** : affine les réglages des leviers, lit les hypothèses du modèle (ce document) et exporte les séries temporelles en CSV.

## Plan de la documentation

| Chapitre | Contenu |
|---|---|
| **Guide d'utilisation** | Parcours complet, outils, raccourcis clavier |
| **Le modèle biologique** | Variables d'état, équations, paramètres, déroulé d'un pas de temps |
| **Les leviers de lutte** | Formalisation mathématique de chaque levier |
| **Calcul économique & indicateurs** | Chiffre d'affaires, coûts, bilan, IFT, score multicritère |
| **Architecture technique** | Moteur, Web Worker, état, persistance, partage, performances |
| **Limites & calibration** | Hypothèses, ordres de grandeur, comment calibrer, tests |
| **Analyse du DrosoSim institutionnel** | Ce que l’on sait du modèle de drososim.fr (code client + publications) |
| **Brancher son backend** | Contrat d'échange, backends HTTP / WebSocket, exemples Node et Python |
| **Modifier le code** | Carte du code, recettes (levier, type de case, graphique, format), déploiement |
