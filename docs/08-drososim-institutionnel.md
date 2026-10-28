---
title: Analyse du DrosoSim institutionnel
icon: search
---

# Analyse du modèle de drososim.fr

Ce chapitre résume ce que l'on peut savoir du modèle utilisé par l'outil institutionnel **drososim.fr**, à partir :
1. du **code JavaScript public** servi au navigateur (application Angular, `main-*.js`) ;
2. des **publications en libre accès** de l'équipe qui le développe.

> **Important.** Le calcul de drososim.fr est **exécuté sur leur serveur** : les équations ne sont pas présentes dans le navigateur. Ce qui suit distingue donc ce qui est **confirmé** (lu dans le code ou dans une publication) de ce qui est **déduit** (hypothèse cohérente avec les indices). Aucune protection n'a été contournée : HAL protège ses fichiers par un anti-robot, et ces documents n'ont pas été téléchargés.

## 1. Qui développe DrosoSim ?

✅ *Confirmé (page partenaires du site)* : équipe **M2P2, INRAE Sophia Antipolis**, avec Louise van Oudenhove, Jules Guilberteau, Jean Bienvenue Dinaharison, Mohammed Bouziane, Suzanne Touzeau et Ludovic Mailleret. Partenaires : CTIFL, Université Côte d'Azur, plan Écophyto, OFB.

Publication associée : *DROSOSIM : Outil d'Aide à la Réflexion pour la gestion de D. suzukii* (Dinaharison, Guilberteau, Bouziane, Touzeau, Mailleret, van Oudenhove, 2026, conférence, HAL `hal-05800706`).

## 2. Architecture de l'outil (confirmé)

| Élément | Constat |
|---|---|
| Calcul | côté serveur, via **WebSocket** `wss://drososim.fr/simulation` |
| Concurrence | nombre de « slots » limité (message `status: "slots"`), délai de calcul maximal (`SIMULATION_TIMEOUT`) |
| Contrainte | « Le design doit contenir au moins une parcelle de type Forêt », faute de quoi le serveur renvoie `SIMULATION_MATH_ERROR` |
| Sorties | séries temporelles par parcelle au format *pandas* (`DataFrame.to_json`), ce qui suggère un **serveur Python** |

### Requête envoyée au serveur

```json
{ "type": "play", "exp_name": "Stratégie A",
  "data": {
    "date_0": "2024-09-21",                  // départ automne (ou 2025-03-21 au printemps)
    "date_end": "2025-09-21",                // + 1, 2 ou 3 ans
    "parcelles": [{
      "name": "<id>", "type": "cherry_early | cherry_late | wild",
      "set": [[ligne, colonne], ...],        // cases de la grille formant la parcelle
      "levers": {
        "harvest":     [{ "date": "...", "proportion": 0.95 }],
        "prophylaxis": [{ "date": "...", "proportion": 0.10 }],
        "pesticides":  [{ "date": "...", "proportion": 0.95 }],
        "parasitoids": [{ "date": "...", "number": 100 }],
        "steriles":    [{ "date": "...", "number": 5000 }],
        "net":         [{ "date_0": "fermeture", "date_end": "ouverture", "coefficient": 0.95 }]
      } }] } }
```

### Réponse du serveur

- `output` (stratégie) et `control` (**témoin**) contiennent chacun `{ dates, solution }`, avec `solution[parcelle]` = séries des **variables d'état**.
- Variables d'état visibles : **`Fertile_Females`** et **`Mix_Females`**.
- La courbe affichée par le client vaut **`Fertile_Females + 0,5 × Mix_Females`**.
- `damages[année][parcelle]` : pourcentage affiché dans l'histogramme (calculé par le serveur).

### Phénologie et leviers par défaut (lus dans le code)

| Paramètre | Précoce | Tardive |
|---|---|---|
| Début de maturité | 1er mai | 24 mai |
| Récolte | 16 mai | 14 juin |
| Pesticide (efficacité 0,95) | 2, 7 et 12 mai | 4, 10, 25 et 30 mai |
| Filet (étanchéité 0,95, réglable de 0,5 à 1) | fermé du 1er au 16 mai | fermé du 24 mai au 14 juin |
| TIS | 3 lâchers de 5 000 mâles stériles, aux dates de maturité −2, −1 et 0 (unité probable : semaines) | idem |
| Parasitoïdes | 2 lâchers de 100, à la maturité −2 et à la maturité | idem |
| Prophylaxie | ramassage de 10 % à la récolte (maximum 95 %) | idem |
| Récolte | proportion récoltée (0,95 par défaut dans le formulaire) | idem |

Le code contient aussi deux leviers **non exposés** dans l'interface : **piège** (« taux d'attraction ») et **argile** (« taux de répulsion »).

## 3. Le cœur démographique publié (confirmé)

L'équipe a publié le modèle de population de *D. suzukii* avec TIS dans **Courtois, van Oudenhove, Touzeau, Grognard & Mailleret (2026), « Polyandry: A threat or an opportunity for the Sterile Insect Technique? », *PLoS Computational Biology*, doi:10.1371/journal.pcbi.1014212** (libre accès).

C'est un **système d'équations différentielles ordinaires (EDO)** à compartiments.

### Variables

| Symbole | Compartiment |
|---|---|
| $L$ | larves (œufs + larves + pupes) |
| $M$ | mâles sauvages |
| $S$ | mâles stériles lâchés |
| $F_U$ | femelles non accouplées |
| $F_F$ | femelles **fécondées** (accouplées avec un mâle sauvage) |
| $F_I$ | femelles **infertiles** (accouplées avec un mâle stérile) |

### Équations (modèle complet, éq. 1)

$$
\begin{aligned}
\dot L &= \omega\left(1-\frac{L}{K}\right)F_F - (\mu_L+\nu)\,L \\
\dot M &= \nu\,p\,L - \mu_M\,M \\
\dot F_U &= \nu(1-p)\,L + \tau_F F_F + \tau_I F_I - (\mu_F+\chi)\,F_U \\
\dot F_I &= \chi\,\frac{\eta S}{M+\eta S}\,F_U - (\tau_I+\mu_F)\,F_I \\
\dot F_F &= \chi\,\frac{M}{M+\eta S}\,F_U - (\tau_F+\mu_F)\,F_F \\
\dot S &= -\mu_S\,S + \sigma
\end{aligned}
$$

Lecture :
- seules les femelles fécondées pondent, avec une **densité-dépendance logistique** sur les larves ;
- à l'accouplement, la probabilité de tomber sur un mâle stérile vaut $\frac{\eta S}{M+\eta S}$, où $\eta$ est la compétitivité des mâles stériles ;
- après une période réfractaire (taux $\tau_F$ ou $\tau_I$), la femelle redevient réceptive : c'est la **polyandrie**.

Comme le taux d'accouplement $\chi \approx 10$ /j est très grand, une **approximation lente-rapide** élimine $F_U$ (éq. 2) :

$$
\begin{aligned}
\dot F_I &= \nu(1-p)\frac{\eta S}{M+\eta S}L + \tau_F\frac{\eta S}{M+\eta S}F_F - \left(\mu_F + \tau_I\frac{M}{M+\eta S}\right)F_I \\
\dot F_F &= \nu(1-p)\frac{M}{M+\eta S}L + \tau_I\frac{M}{M+\eta S}F_I - \left(\mu_F + \tau_F\frac{\eta S}{M+\eta S}\right)F_F
\end{aligned}
$$

### Paramètres estimés pour *D. suzukii* (tableau 2 de l'article)

| Paramètre | Valeur |
|---|---|
| $\mu_L$ mortalité larvaire | 0,037 /j |
| $\mu_F$ mortalité des femelles | 0,012 /j |
| $\mu_M$ mortalité des mâles | 0,013 /j |
| $\mu_S$ mortalité des mâles stériles | 0,054 /j |
| $\omega$ ponte | 6 œufs/♀/j |
| $\nu$ émergence | 0,08 /j |
| $p$ sex-ratio | 0,5 |
| $\chi$ taux d'accouplement | 10 /j |
| $\eta$ compétitivité des mâles stériles | 0,6 |
| $K$ capacité d'accueil | 36 000 larves (tunnel de fraises d'environ 500 m²) |
| $\tau_F$ / $\tau_I$ périodes réfractaires | 0,12 / 0,14 /j |

### Résultats analytiques

- **Nombre de reproduction de base** : $\mathcal R_0$, nombre moyen de filles viables par femelle. Il dépend de $\omega$, $\nu$, $p$ et des mortalités ; l'expression exacte est donnée dans l'article.
- **Seuil d'éradication par TIS** (bifurcation col-nœud) :
$$
\bar\sigma = \frac{K\,\gamma\,\mu_S(\mathcal R_0-1)^2(\mu_F+\tau_I)}{4\,\eta\,\mathcal R_0\,(\mu_F+\tau_F)}, \qquad \gamma = \frac{\nu p}{\mu_M}
$$
Au-dessus de ce taux de lâcher, seul l'équilibre sans ravageur est stable ; en dessous, le résultat dépend de la densité initiale.

## 4. Ce qu'on en déduit pour DrosoSim (hypothèses)

🟡 *Déduit, non confirmé* — le modèle serveur de drososim.fr est très probablement :

1. **le système d'EDO ci-dessus, appliqué dans chaque parcelle**, avec une variante « sperme mixte » : `Mix_Females` = femelles accouplées à la fois avec un mâle sauvage et un mâle stérile, de fertilité 1/2. C'est ce qui explique le calcul `Fertile + 0,5 × Mix` du client, et ce scénario est étudié dans l'article ;
2. **couplé entre parcelles** par des termes de **migration** entre parcelles voisines (le champ `set` donne la géométrie). L'**espace naturel** est obligatoire car il sert de **réservoir et de source** (sinon `SIMULATION_MATH_ERROR`) ;
3. avec une **ressource fruitière** variable : capacité $K$ liée aux dates de maturité et de récolte ;
4. des **leviers impulsionnels** aux dates données :
   - pesticide = retrait instantané de 95 % des adultes ;
   - récolte et prophylaxie = retrait d'une proportion des fruits ou des larves ;
   - TIS = ajout ponctuel de $S$ ;
   - parasitoïdes = ajout d'une population de parasitoïdes, probablement de type hôte-parasitoïde sur $L$ ;
   - filet = coefficient d'étanchéité qui réduit la migration entrante entre la fermeture et l'ouverture ;
5. **résolu numériquement** (probablement SciPy `solve_ivp`), d'où un temps de calcul de l'ordre de la seconde et la gestion de files d'attente.

Ces points ne pourront être confirmés qu'avec la publication de l'outil (`hal-05800706`) ou le code source du serveur.

## 5. Comparaison avec le modèle de DrosoSim Next

| Aspect | drososim.fr (publié / déduit) | DrosoSim Next |
|---|---|---|
| Formalisme | EDO continues, résolues numériquement | équations aux différences journalières |
| Sexes / accouplement | mâles, femelles fécondées / infertiles / mixtes | femelles seules ; TIS via un facteur de fertilité |
| TIS | mécaniste : $\frac{M}{M+\eta S}$, polyandrie | phénoménologique : $1/(1+0{,}12\times\text{ratio})$ |
| Espace | parcelles couplées (migration) | grille de 400 cases, dispersion vers les 8 voisines |
| Stades | larves (un compartiment), femelles, mâles | trois sous-stades immatures (délai gamma), femelles |
| Température | non visible dans le client | sinusoïde + variabilité synoptique déterministe + profils ; phénologie thermique |
| Leviers | impulsions datées, réglables | impulsions et effets continus, réglages agronomiques |
| Paramètres | **issus de la littérature** (tableau ci-dessus) | choisis pour des ordres de grandeur plausibles |
| Calcul | serveur, environ 1 s, slots limités | navigateur, environ 20 ms par stratégie |

### Ce qui pourrait être repris
- les **paramètres démographiques publiés** ($\mu_L$, $\mu_F$, $\mu_M$, $\nu$, $\omega$, $\eta$…) à la place de nos valeurs choisies ;
- un **compartiment mâles et mâles stériles** avec probabilité d'accouplement $\frac{M}{M+\eta S}$, pour une TIS mécaniste avec la polyandrie ;
- le **nombre de reproduction** $\mathcal R_0$ et le **seuil d'éradication** $\bar\sigma$ affichés comme indicateurs.
