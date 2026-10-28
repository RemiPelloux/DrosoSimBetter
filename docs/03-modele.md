---
title: Le modèle biologique
icon: bug
---

# Le modèle biologique

Ce chapitre décrit **ce que calcule le moteur** (`src/lib/engine.ts`, modèle v2) et *pourquoi* chaque mécanisme existe. Les valeurs numériques sont celles utilisées par défaut. La spécification exhaustive, symbole par symbole, est au chapitre [Spécification du moteur](11-modele-mathematique.md).

## 1. Vue d'ensemble

Le modèle est **spatialisé, déterministe et à pas de temps journalier** :

- **espace** : une grille de $20 \times 20 = 400$ cases. Chaque case représente $S_c$ m² (100 m² par défaut, soit 0,01 ha), donc la grille couvre 4 ha par défaut ;
- **temps** : $t = 0, 1, \dots, T_{tot}-1$ jours, avec $T_{tot} = 365 \times N_{ans}$ (plus 92 jours pour un départ à l'automne) ;
- **population** : par case, des **femelles adultes** $A$ (seules les femelles sont suivies, puisque ce sont elles qui pondent) et des **immatures** répartis en trois sous-stades successifs $S_1, S_2, S_3$ (œufs → larves → pupes), ce qui donne au développement un **délai réaliste** au lieu d'une émergence immédiate ;
- **dégâts** : une fraction de **fruits sains** $H$ par case de cerisier, remise à 1 chaque 1er janvier.

```diagram-cycle
```

Chaque stratégie (et le témoin) fait l'objet d'une **simulation complète et indépendante**. Les leviers ne sont donc pas des coefficients appliqués après coup : ils modifient la ponte, la survie, la mortalité et la dispersion **pendant** le calcul, et leurs effets se propagent dans l'espace et d'une année à l'autre.

## 2. Variables d'état

Pour chaque case $c$ et chaque jour $t$ :

| Symbole | Signification | Unité |
|---|---|---|
| $A_c(t)$ | femelles adultes présentes dans la case | individus / case |
| $S_{1,c}, S_{2,c}, S_{3,c}$ | immatures en début, milieu et fin de développement | individus / case |
| $H_c(t)$ | fraction de fruits encore sains (année en cours) | 0 – 1 |
| $R_c(t)$ | fruits résiduels après récolte (non cueillis ou tombés) | 0 – 1 |
| $P_c$ | pic de densité atteint | femelles / ha |

Les densités affichées sont converties par hectare : $\text{densité} = A_c \times \dfrac{10\,000}{S_c}$.

## 3. Calendrier et phénologie thermique

Le jour de l'année est noté $j \in [0, 364]$, avec $j = 0$ au 1er janvier. La simulation démarre à $j_0 = 59$ (1er mars) au printemps, ou à $j_0 = 273$ (1er octobre) à l'automne.

Chaque type de cerisier possède une **fenêtre de sensibilité** $[v, h)$ : de la véraison $v$ (les fruits deviennent attractifs et pondables) à la récolte $h$. Dans le climat de référence :

| Type | Véraison $v$ | Récolte $h$ | Dates | Durée de maturation |
|---|---|---|---|---|
| Précoce | 130 | 158 | 10 mai → 7 juin | 28 j |
| Saison | 150 | 178 | 30 mai → 27 juin | 28 j |
| Tardive | 168 | 200 | 17 juin → 19 juillet | 32 j |

**Nouveauté v2 — la véraison est pilotée par la température.** Le moteur cumule les degrés-jours au-dessus de 8 °C depuis le 1er janvier ; la véraison a lieu le jour où ce cumul atteint la valeur qu'il prend, dans le climat de référence, à la date nominale. Un printemps frais retarde donc la véraison (+3 jours en *printemps humide*), un été chaud avance celle des tardives (−2 jours en *été caniculaire*). Les dates effectivement utilisées sont renvoyées avec les résultats et dessinées sur les courbes.

```diagram-phenologie
```

C'est **le cœur du raisonnement agronomique** : la population croît tout le printemps et culmine en été. Une variété précoce est récoltée avant le pic, alors qu'une variété tardive mûrit en plein pic.

## 4. Forçage climatique

### 4.1 Température journalière

$$
T(j) = 12{,}5 + 10{,}5 \,\sin\!\left(\frac{2\pi\,(j - 110)}{365}\right) + \underbrace{2{,}0\,\sin\!\left(\tfrac{2\pi j}{6{,}9} + 0{,}7\right) + 1{,}3\,\sin\!\left(\tfrac{2\pi j}{17{,}3} + 2{,}1\right)}_{\text{variabilité synoptique } (\pm 3{,}3\ ^\circ\text{C})} + \Delta_{climat}(j)
$$

La sinusoïde annuelle donne environ 2 °C mi-janvier et 23 °C mi-juillet. Les deux oscillations courtes, de périodes **incommensurables**, imitent les passages de masses d'air (coups de froid, épisodes chauds) **sans aucun tirage aléatoire** : le modèle reste parfaitement reproductible. Grâce à elles, les seuils biologiques (gel, 30 °C) sont réellement franchis.

| Profil | Correction $\Delta_{climat}$ | $T_{min}$ / $T_{max}$ | Jours < 6 °C | Jours > 30 °C | Surmortalité hivernale $\mu_{hiv}$ | Autres effets |
|---|---|---|---|---|---|---|
| Hiver doux | +3,5 °C en hiver ($j<60$ ou $j>320$) | 1,4 / 25,9 | 51 | 0 | 0,016 /j | — |
| Hiver rigoureux | −4 °C en hiver | −5,2 / 25,9 | 117 | 0 | 0,050 /j | — |
| Printemps humide | −0,5 °C de $j=80$ à 180 | −1,2 / 25,9 | 101 | 0 | 0,028 /j | ponte × 1,25 ; rémanence des traitements × 0,6 ; véraison +3 j |
| Été caniculaire | +5 °C de $j=160$ à 250 | −1,2 / 30,9 | 100 | 5 | 0,028 /j | ponte freinée et mortalité accrue au-delà de 28 °C ; tardive avancée de 2 j |

### 4.2 Aptitude thermique de la ponte

$$
\varphi(T) = \begin{cases}
0 & T \le 10 \text{ ou } T \ge 33 \\
(T-10)/10 & 10 < T < 20 \\
1 & 20 \le T \le 26 \\
(33-T)/7 & 26 < T < 33
\end{cases}
$$

### 4.3 Vitesse de développement (degrés-jours)

Le passage œuf → adulte nécessite environ **210 degrés-jours au-dessus de 8 °C**. Chaque jour, une fraction $3\,\delta(T)$ des individus de chaque sous-stade passe au suivant :

$$
\delta(T) = \min\!\left(1,\; \frac{\max(0,\,T-8)}{210}\right)
$$

Trois sous-stades traversés à ce rythme donnent une durée totale de moyenne $1/\delta$ (par exemple **15 jours à 22 °C**) mais, contrairement à un compartiment unique, **presque aucun individu n'émerge avant une dizaine de jours** : les générations restent distinctes au printemps, puis se chevauchent en été. C'est un *délai distribué d'ordre 3* (loi gamma).

### 4.4 Réponses au froid et à la chaleur

Les réponses sont **continues** : pas de seuil tout-ou-rien.

- **Froid** : sous 6 °C, la surmortalité hivernale $\mu_{hiv}$ du profil s'applique avec un facteur qui croît linéairement de 0 (à 6 °C) à 1 (à 2 °C) et plafonne à 1,5 à partir de 0 °C. Dans l'**espace naturel**, ce facteur est divisé par deux (abri).
- **Chaleur** : au-dessus de 28 °C, la mortalité adulte augmente de 0,012 par degré, jusqu'à +0,06 /j à 33 °C. Seul le profil *été caniculaire* atteint ces températures.

**Survie hivernale résultante** (1er octobre → 1er mars, en l'absence de reproduction, mortalité de base comprise) :

| Profil | Plein champ | Espace naturel |
|---|---|---|
| Hiver doux | ≈ 1,2 % | ≈ 1,3 % |
| Référence / printemps humide / été caniculaire | ≈ 0,2 % | ≈ 0,6 % |
| Hiver rigoureux | < 0,01 % | ≈ 0,05 % |

L'hiver est donc un **goulot d'étranglement** de deux à trois ordres de grandeur, plus sévère en plein champ qu'en espace naturel : c'est ce qui fait des haies et des bois le réservoir d'hivernage.

## 5. Ressource, capacité et attractivité

### 5.1 Ressource pour la ponte (ρ)

- **Espace naturel** (ronces, sureau, lierre…) :
$$
\rho_{nat}(j) = \begin{cases} 0{,}05 & j < 95 \\ 0{,}12 + 0{,}28\,\max\!\left(0,\sin\frac{\pi (j-95)}{270}\right) & \text{sinon} \end{cases}
$$
- **Cerisier** :
  - avant véraison : $\rho = 0{,}02$ ;
  - pendant la fenêtre $[v,h)$ : $\rho = 1$ (les fruits sont pondables et donc endommageables) ;
  - à partir du jour $h$ de la récolte : les fruits non cueillis deviennent des **résidus** $R_c$ (voir *Prophylaxie*), puis $R_c \leftarrow 0{,}965\,R_c$ chaque jour (pourriture, dessèchement) et $\rho = 1{,}4\,R_c + 0{,}02$.
- **Zone neutre** : $\rho = 0{,}003$.

### 5.2 Capacité d'accueil proportionnelle à la ressource (K)

**Nouveauté v2.** La capacité $K_c$ qui limite la ponte n'est plus fixe : elle suit la ressource du jour,

$$
K_c = K_{type} \times \max\!\big(0{,}25,\ \hat\rho_c\big),
\qquad K_{type} = 260 \text{ (espace naturel)},\ 700 \text{ (cerisier)},\ 8 \text{ (neutre)}
$$

où $\hat\rho$ est la ressource normalisée (ρ pour le cerisier, $\rho_{nat}/0{,}4$ pour l'espace naturel). Un cerisier récolté n'offre plus qu'une capacité réduite (≈ 210 femelles/case avec 20 % de fruits résiduels, ≈ 175 après une prophylaxie sérieuse) : la population post-récolte **décline au lieu de stagner au plafond**, et l'hivernage part d'un niveau crédible. Le plancher de 25 % représente l'abri et les ressources non modélisées.

Par ailleurs, lorsque les adultes dépassent la capacité *statique* $K_{type}$ (par exemple par afflux de migrantes vers un verger en véraison), une **mortalité de surpeuplement** s'ajoute : $0{,}15 \times (A_c/K_{type} - 1)$ par jour. Elle remplace l'ancien plafond brutal à $1{,}3\,K$.

### 5.3 Attractivité pour la dispersion (w)

| Case | $w_c$ |
|---|---|
| Espace naturel | $0{,}6 + \rho_{nat}(j)$ |
| Cerisier, de $v-5$ à $h$ | **3** (fruits mûrissants très attractifs) |
| Cerisier à partir de la récolte | $0{,}3 + 3\,R_c$ |
| Cerisier hors saison | 0,25 |
| Zone neutre | 0,15 |

## 6. Le pas de temps journalier

```diagram-pas-de-temps
```

Chaque jour, dans cet ordre :

1. **Climat** : lecture de $T$, $\varphi(T)$, $\delta(T)$, $\rho_{nat}$ et des facteurs froid / chaleur dans des tables pré-calculées par profil.
2. **Traitements** : déclenchement éventuel par parcelle (voir *Les leviers*).
3. **Dynamique locale**, case par case, en une seule passe : ressource, capacité, attractivité et filet du jour, puis ponte, dégâts, chaîne immature, mortalité.
4. **Dispersion** des adultes vers les 8 voisines.
5. **Bilan** : enregistrement des récoltes, échantillonnage des séries tous les 3 jours.

### 6.1 Ponte

$$
E_c = A_c \times \underbrace{8}_{\text{œufs / femelle / jour (max.)}} \times \varphi(T) \times \rho_c \times (1-\eta_c) \times \tau_c \times \left(1 - \frac{A_c}{K_c}\right)^{\!+} \times h_{hum}
$$

- $\eta_c$ : efficacité du filet actif (0 si aucun filet) ;
- $\tau_c$ : fraction de pontes fertiles (TIS) ;
- $K_c$ : capacité du jour (§ 5.2) ; le terme $(1 - A/K)^+$ est une densité-dépendance logistique sur la ponte ;
- $h_{hum} = 1{,}25$ en printemps humide, 1 sinon.

### 6.2 Dégâts sur fruits

Pendant la fenêtre de sensibilité seulement, chaque œuf pondu peut endommager un fruit sain :

$$
H_c \leftarrow H_c \times \exp\!\left(-\frac{E_c}{3\,500}\right)
$$

Cette forme exponentielle (loi de Poisson) traduit le fait que les œufs se répartissent au hasard sur les fruits : les premiers abîment des fruits sains, les suivants tombent de plus en plus souvent sur des fruits déjà touchés. La constante 3 500 représente le nombre d'« œufs efficaces » nécessaire pour faire chuter la fraction saine à $e^{-1} \approx 37\,\%$ sur une case (2 426 œufs pour la faire passer à 50 %).

Le jour de la récolte $h$, la **récolte saine de la parcelle** est la moyenne de $H_c$ sur ses cases. C'est la valeur affichée (en %), moyennée sur les années simulées.

### 6.3 Immatures : la chaîne de sous-stades

$$
\begin{aligned}
S_1 &\leftarrow (S_1 - 3\delta S_1)(1-\mu_L) + 0{,}30\,E_c \\
S_2 &\leftarrow (S_2 - 3\delta S_2)(1-\mu_L) + 3\delta S_1 \\
S_3 &\leftarrow (S_3 - 3\delta S_3)(1-\mu_L) + 3\delta S_2 \times (1 - \pi_c) \\
\text{Émergence} &= 3\delta S_3
\end{aligned}
$$

- 0,30 : fraction d'œufs viables (survie précoce) ;
- $\mu_L$ : mortalité des immatures, 0,012 /j (0,03 /j si $T < 5$ °C) ;
- $\pi_c$ : fraction de larves parasitées (0 sans lâcher), appliquée **à la sortie du stade larvaire** $S_2$, là où agissent *Ganaspis* et *Trichopria*.

### 6.4 Adultes

$$
A_c \leftarrow A_c\,(1 - \mu_c) + \text{Émergence}
$$

avec une mortalité journalière plafonnée à 0,95 :

$$
\mu_c = \underbrace{0{,}028}_{\text{base}} + \underbrace{\mu_{chaleur}(T)}_{T>28} + \underbrace{\mu_{hiv}\, f_{froid}(T) \times (0{,}5 \text{ en espace naturel})}_{T<6} + \underbrace{0{,}04\,[\text{neutre}]}_{\text{milieu hostile}} + \underbrace{0{,}15\,(A_c/K_{type}-1)^+}_{\text{surpeuplement}} + \underbrace{\kappa_p\,[\text{traitement actif}]}_{\text{traitement}}
$$

Une mortalité de base de 2,8 % par jour correspond à une **espérance de vie adulte d'environ 36 jours**. À 22 °C, l'ensemble ponte + chaîne immature + mortalité donne un taux d'accroissement intrinsèque $r \approx 0{,}22$ /jour (temps de doublement ≈ 3 jours), dans la fourchette des mesures de laboratoire pour *D. suzukii*.

### 6.5 Dispersion

Chaque jour, une fraction $D$ des femelles quitte sa case :

$$
D = \begin{cases} 0{,}12 & T > 10\,^\circ\text{C} \\ 0{,}03 & \text{sinon}\end{cases}
$$

Les émigrantes se répartissent entre les **8 voisines** (voisinage de Moore) au prorata de leur attractivité. **Nouveauté v2 — le filet est symétrique** : il refoule 70 % × $\eta$ des femelles qui tentent d'entrer *et* freine d'autant celles qui tentent de sortir. Les refoulées restent dans leur case de départ : la dispersion **conserve exactement** le nombre d'individus.

```diagram-voisinage
```

À l'échelle du verger, cette règle produit un **flux orienté** : au printemps les adultes « coulent » de l'espace naturel vers les cerisiers en véraison, puis d'une variété à l'autre au fil des maturités, puis reviennent vers les refuges ou les résidus après la récolte.

## 7. Initialisation

| Case | Départ printemps (1er mars) | Départ automne (1er octobre) |
|---|---|---|
| Espace naturel | 20 femelles/case (2 000 /ha) | 50 /case (5 000 /ha) |
| Cerisier | 1 /case (100 /ha) | 1 /case |
| Neutre | 0 | 0 |

Les immatures partent de zéro et les fruits sont sains. La présence de quelques survivantes dans les cerisiers eux-mêmes (et pas seulement dans le bois) reflète l'hivernage *in situ* observé au verger ; un verger **sans espace naturel** démarre néanmoins avec une population dix fois plus faible.

## 8. Ce que donne le verger de démonstration

Témoin sans protection, départ au printemps, trois années (récolte saine par variété, année 1 / 2 / 3) :

| Profil | Précoce | Saison | Tardive | Pic (♀/ha) |
|---|---|---|---|---|
| Hiver doux | 97 / 78 / 78 % | 82 / 34 / 35 % | 51 / 6 / 9 % | ≈ 127 000 |
| Hiver rigoureux | 97 / 94 / 94 % | 86 / 72 / 73 % | 56 / 34 / 38 % | ≈ 122 000 |
| Printemps humide | 95 / 80 / 80 % | 75 / 41 / 42 % | 31 / 8 / 10 % | ≈ 141 000 |
| Été caniculaire | 96 / 90 / 90 % | 79 / 51 / 51 % | 48 / 18 / 20 % | ≈ 114 000 |

On lit directement les trois messages du simulateur : la **précocité protège**, la **pression s'installe** d'une année sur l'autre quand rien n'est fait, et le **climat module** fortement le résultat (l'hiver rigoureux divise par deux les pertes en année 2).

## 9. Sorties calculées

| Sortie | Définition |
|---|---|
| Récolte saine par parcelle (%) | $\overline{H}$ le jour de récolte, moyenne sur les années (et détail par année) |
| Récolte globale (%) | moyenne des parcelles de cerisiers pondérée par leur surface |
| Pic de femelles/ha | $\max_t$ de la densité, toutes cases de cerisier confondues |
| Carte de pression | $P_c = \max_t A_c \times 10\,000/S_c$ pour chaque case |
| Séries temporelles | densité moyenne par parcelle (et moyenne espace naturel / cerisiers), % de fruits sains, tous les 3 jours |
| Événements | dates des traitements, poses de filets, récoltes, lâchers |
| Passages de traitement | nombre réellement déclenché, qui sert au calcul des coûts et de l'IFT |
| Phénologie et climat | fenêtres véraison → récolte du profil ; $T_{min}$, $T_{max}$, degrés-jours, jours froids et chauds |

## 10. Tableau récapitulatif des paramètres

| Paramètre | Valeur | Rôle |
|---|---|---|
| Fécondité max | 8 œufs/♀/j | ponte |
| Seuils de ponte | 10 °C / 20-26 °C / 33 °C | aptitude thermique |
| Développement | 210 DJ > 8 °C, 3 sous-stades | durée et étalement œuf → adulte |
| Survie des œufs | 0,30 | fraction entrant dans la chaîne immature |
| Mortalité immatures | 0,012 /j (0,03 si T < 5 °C) | — |
| Mortalité adultes | 0,028 /j | ≈ 36 j de vie |
| Stress thermique | +0,012 /j par °C > 28 °C, max +0,06 | été caniculaire |
| Froid | $\mu_{hiv}$ × rampe (6 → 2 °C), max × 1,5 ; ÷ 2 en espace naturel | hivernage |
| Surmortalité zone neutre | +0,04 /j | milieu hostile |
| Capacités $K_{type}$ | 260 / 700 / 8 par case, × ressource (plancher 25 %) | espace naturel / cerisier / neutre |
| Surpeuplement | 0,15 × $(A/K_{type}-1)^+$ /j | remplace le plafond |
| Dispersion | 12 %/j (3 % si T ≤ 10 °C), filet symétrique 70 % × η | 8 voisines |
| Constante de dégâts | 3 500 œufs | courbe de Poisson |
| Décroissance des résidus | ×0,965 /j | demi-vie ≈ 20 j |
| Variabilité synoptique | ±3,3 °C, périodes 6,9 et 17,3 j | extrêmes déterministes |

Tous ces paramètres sont regroupés dans l'objet `PARAMS` de `src/lib/engine.ts`, ce qui permet de les modifier (ou de les explorer automatiquement) sans toucher à la boucle de calcul.
