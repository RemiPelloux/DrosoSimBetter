---
title: Limites & calibration
icon: alert
---

# Limites, validation & calibration

## 1. Ce que le modèle sait faire

Le modèle reproduit **qualitativement** les comportements attendus. Ils sont vérifiés à chaque exécution de `npm run test:engine` sur le verger de démonstration (départ printemps, trois ans, récolte saine année 1 / 2 / 3) :

| Comportement attendu | Observé dans le modèle |
|---|---|
| Les variétés précoces échappent au pic estival | Témoin, hiver doux : précoce 97 / 78 / 78 %, tardive 51 / 6 / 9 % |
| La pression s'installe quand rien n'est fait | Saison 82 % en année 1, 34 % en année 2 |
| Un hiver rigoureux réduit la pression | Tardive 56 / 34 / 38 % (contre 51 / 6 / 9 % en hiver doux) |
| Un printemps humide l'aggrave, un été caniculaire la freine | Tardive 31 / 8 / 10 % (humide), 48 / 18 / 20 % (caniculaire) |
| Les traitements seuls s'épuisent sur plusieurs années | Tardive, 2 passages conventionnels : 82 % en année 1, 31 % en année 2 |
| La prophylaxie et les parasitoïdes agissent sur le long terme | Parasitoïdes : +10 points en année 1, +31 points en année 3 sur la tardive |
| Le filet est le plus efficace sur la récolte | 100 % par parcelle (99,9 % en global), quelle que soit la variété |
| La TIS est très sensible au ratio | Tardive : 95 / 68 / 67 % à 10:1, 98 / 95 / 91 % à 20:1 |
| L'absence de refuge limite l'infestation initiale | Population initiale divisée par dix sans espace naturel |
| L'hiver est un goulot d'étranglement | Survie d'octobre à mars ≈ 1 % (hiver doux) à < 0,1 % (rigoureux) |

## 2. Simplifications majeures

1. **Paramètres non calibrés** : fécondité, mortalités, capacités, dispersion et constante de dégâts ont été choisis pour obtenir des ordres de grandeur plausibles (taux d'accroissement ≈ 0,22 /j à 22 °C, durée de développement 15 j, vie adulte 36 j) **mais pas ajustés sur des données de piégeage ou de dégâts**.
2. **Climat synthétique** : une sinusoïde annuelle corrigée par profil, plus une variabilité synoptique *déterministe* (deux oscillations de périodes 6,9 et 17,3 jours). Il n'y a ni pluie explicite, ni humidité, ni données météo réelles, ni variabilité interannuelle : chaque année a exactement le même climat.
3. **Seules les femelles sont suivies** ; l'accouplement n'est représenté que via la TIS.
4. **Structure d'âge sommaire** : trois sous-stades immatures de même durée (délai de loi gamma d'ordre 3). C'est mieux qu'un compartiment unique, mais les durées relatives œuf / larve / pupe ne sont pas distinguées, et les adultes n'ont pas d'âge (fécondité et mortalité constantes au cours de la vie).
5. **Phénologie thermique simplifiée** : la véraison suit les degrés-jours cumulés depuis le 1er janvier (sans besoin en froid ni date de floraison explicite) et la durée de maturation est fixe.
6. **Une seule espèce d'hôte sauvage**, à la ressource moyenne étalée ; pas d'hôtes cultivés autres que le cerisier.
7. **Capacité d'accueil heuristique** : proportionnelle à la ressource du jour avec un plancher de 25 %, et mortalité de surpeuplement linéaire au-delà de la capacité statique ; aucun de ces coefficients n'est mesuré.
8. **Économie simplifiée** : prix et rendement uniques, fruit piqué = perte totale, coûts forfaitaires sans subventions, TVA ni durée d'amortissement explicite.
9. **Pas de résistance** aux insecticides, ni d'effet non intentionnel sur les auxiliaires ; les traitements n'atteignent que les adultes.
10. **Grille fermée** : pas d'immigration depuis l'extérieur de la zone dessinée.

## 3. Bon usage

- ✅ Comparer **des stratégies entre elles** sur un même verger.
- ✅ Comprendre **le rôle du calendrier** (variétés, pic estival, post-récolte), du **climat** et du **paysage** (refuges).
- ✅ Animer une réunion, une formation Écophyto, un échange conseiller / producteur.
- ❌ Prédire un rendement ou un revenu réel.
- ❌ Fixer une date de traitement (utiliser les réseaux de piégeage et les bulletins de santé du végétal).

## 4. Comment calibrer le modèle

Tous les paramètres sont regroupés dans l'objet `PARAMS` de `src/lib/engine.ts`, modifiable à l'exécution (voir *Modifier le code*). Démarche conseillée :

1. **Température** : remplacer `temperature(j, profil)` par une série journalière réelle (station météo). Le reste du moteur ne lit que la table climatique, donc $\varphi(T)$, $\delta(T)$, les mortalités froid / chaleur et la phénologie thermique deviennent réalistes d'un coup. Supprimer alors la variabilité synoptique synthétique.
2. **Phénologie** : remplacer les seuils de degrés-jours `REF_DD` et les durées de maturation `RIPENING_DAYS` par les valeurs observées des variétés suivies.
3. **Dynamique** : ajuster `fecundity`, `adultMort`, `eggSurvival`, `dispersalWarm`, `K` et `crowdMort` pour reproduire des **courbes de piégeage** (femelles/piège/semaine converties en densité relative) : position du pic, profondeur du creux printanier, niveau d'automne.
4. **Dégâts** : ajuster `damageConst` pour que la récolte saine simulée corresponde aux **taux de fruits piqués** observés.
5. **Leviers** : ajuster $\eta$ (filets), $\kappa$ et la rémanence (traitements), la montée en charge des parasitoïdes et $\tau$ (TIS) à partir d'essais publiés.
6. **Valider** sur une année ou un site non utilisés pour la calibration.

Après chaque modification, lancer `npm run test:engine` (25 vérifications) puis comparer les sorties CSV aux observations. Le chapitre *Spécification du moteur* donne la table maître des paramètres et les formules exactes.

## 5. Pistes d'évolution

- import de séries météo réelles et d'observations de piégeage, avec variabilité interannuelle ;
- calibration automatique (moindres carrés, ABC) à partir de `PARAMS` ;
- stades œuf / larve / pupe de durées distinctes, et effet larvicide partiel de certains insecticides ;
- autres cultures hôtes (fraise, framboise, myrtille) ;
- simulations Monte-Carlo pour afficher une incertitude ;
- moteur en Rust/WebAssembly pour des grilles plus grandes.
