---
title: Limites & calibration
icon: alert
---

# Limites, validation & calibration

## 1. Ce que le modèle sait faire

Le modèle reproduit **qualitativement** les comportements attendus. Ils ont été vérifiés lors du développement sur le verger de démonstration :

| Comportement attendu | Observé dans le modèle |
|---|---|
| Les variétés précoces échappent au pic estival | Témoin année 1 : précoce ≈ 98 % sain, tardive ≈ 47 % |
| Un hiver rigoureux réduit la pression | Récolte témoin sur 3 ans : 40 % (rigoureux) contre 30 % (doux) |
| Un printemps humide l'aggrave | 27 % (humide) contre 30 % (doux) |
| Les traitements seuls s'épuisent sur plusieurs années | Tardive protégée : 79 % en année 1, ≈ 6 % en année 3 (2 passages) |
| La prophylaxie et les parasitoïdes agissent sur le long terme | Effet faible en année 1, croissant ensuite |
| Le filet est le plus efficace sur la récolte | ≈ 99 % de récolte saine, quelle que soit la variété |
| L'absence de refuge limite l'infestation initiale | Population très faible au démarrage sans espace naturel |

## 2. Simplifications majeures

1. **Paramètres non calibrés** : fécondité, mortalités, dispersion et constante de dégâts ont été choisis pour obtenir des ordres de grandeur plausibles, **pas ajustés sur des données de piégeage ou de dégâts**.
2. **Climat synthétique** : une sinusoïde corrigée par profil, sans variabilité journalière, sans pluie explicite, sans données météo réelles.
3. **Seules les femelles sont suivies** ; l'accouplement n'est représenté que via la TIS.
4. **Pas de structure d'âge** dans les compartiments : les immatures émergent selon une fraction journalière, ce qui étale les générations.
5. **Phénologie fixe** : dates de véraison et de récolte identiques chaque année, sans lien avec la température.
6. **Une seule espèce d'hôte sauvage**, à la ressource moyenne étalée ; pas d'hôtes cultivés autres que le cerisier.
7. **Économie simplifiée** : prix et rendement uniques, fruit piqué = perte totale, coûts forfaitaires sans subventions, TVA ni durée d'amortissement explicite.
8. **Pas de résistance** aux insecticides, ni d'effet non intentionnel sur les auxiliaires.
9. **Grille fermée** : pas d'immigration depuis l'extérieur de la zone dessinée.

## 3. Bon usage

- ✅ Comparer **des stratégies entre elles** sur un même verger.
- ✅ Comprendre **le rôle du calendrier** (variétés, pic estival, post-récolte) et du **paysage** (refuges).
- ✅ Animer une réunion, une formation Écophyto, un échange conseiller / producteur.
- ❌ Prédire un rendement ou un revenu réel.
- ❌ Fixer une date de traitement (utiliser les réseaux de piégeage et les bulletins de santé du végétal).

## 4. Comment calibrer le modèle

Tous les paramètres sont regroupés dans `src/lib/engine.ts`. Démarche conseillée :

1. **Phénologie** : remplacer les dates de `PHENOLOGY` par les dates locales de véraison et de récolte des variétés suivies.
2. **Température** : remplacer `temperature(j)` par une série journalière réelle (station météo), ce qui rend $\varphi(T)$, $\delta(T)$ et les mortalités réalistes.
3. **Dynamique** : ajuster la fécondité (6), la mortalité adulte (0,028), la survie larvaire (0,30) et la dispersion (0,12) pour reproduire des **courbes de piégeage** (femelles/piège/semaine converties en densité relative).
4. **Dégâts** : ajuster la constante 3 500 pour que la récolte saine simulée corresponde aux **taux de fruits piqués** observés.
5. **Leviers** : ajuster $\eta$ (filets), $\kappa$ et la rémanence (traitements), et l'effet des parasitoïdes et de la TIS à partir d'essais publiés.
6. **Valider** sur une année ou un site non utilisés pour la calibration.

Après chaque modification, lancer `npm run test:engine` puis comparer les sorties CSV aux observations.

## 5. Pistes d'évolution

- import de séries météo réelles et d'observations de piégeage ;
- calibration automatique (moindres carrés, ABC) ;
- autres cultures hôtes (fraise, framboise, myrtille) ;
- simulations Monte-Carlo pour afficher une incertitude ;
- moteur en Rust/WebAssembly pour des grilles plus grandes.
