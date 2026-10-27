---
title: Le modèle biologique
icon: bug
---

# Le modèle biologique

Ce chapitre décrit **exactement** ce que calcule le moteur (`src/lib/engine.ts`). Chaque formule ci-dessous correspond à une ligne de code. Les valeurs numériques sont celles utilisées par défaut.

## 1. Vue d'ensemble

Le modèle est **spatialisé, déterministe et à pas de temps journalier** :

- **espace** : une grille de $20 \times 20 = 400$ cases. Chaque case représente $S_c$ m² (100 m² par défaut, soit 0,01 ha), donc la grille couvre 4 ha par défaut ;
- **temps** : $t = 0, 1, \dots, T_{tot}-1$ jours, avec $T_{tot} = 365 \times N_{ans}$ (plus 92 jours pour un départ à l'automne) ;
- **population** : deux compartiments par case, les **immatures** $L$ et les **femelles adultes** $A$ (seules les femelles sont suivies, puisque ce sont elles qui pondent dans les fruits) ;
- **dégâts** : une fraction de **fruits sains** $H$ par case de cerisier, remise à 1 chaque 1er janvier.

```diagram-cycle
```

Chaque stratégie (et le témoin) fait l'objet d'une **simulation complète et indépendante**. Les leviers ne sont donc pas des coefficients appliqués après coup : ils modifient la ponte, la survie, la mortalité et la dispersion **pendant** le calcul, et leurs effets se propagent dans l'espace et d'une année à l'autre.

## 2. Variables d'état

Pour chaque case $c$ et chaque jour $t$ :

| Symbole | Signification | Unité |
|---|---|---|
| $A_c(t)$ | femelles adultes présentes dans la case | individus / case |
| $L_c(t)$ | immatures (œufs + larves + pupes) | individus / case |
| $H_c(t)$ | fraction de fruits encore sains (année en cours) | 0 – 1 |
| $R_c(t)$ | fruits résiduels après récolte (non cueillis ou tombés) | 0 – 1 |
| $P_c$ | pic de densité atteint | femelles / ha |

Les densités affichées sont converties par hectare : $\text{densité} = A_c \times \dfrac{10\,000}{S_c}$.

## 3. Calendrier et phénologie

Le jour de l'année est noté $j \in [0, 364]$, avec $j = 0$ au 1er janvier. La simulation démarre à $j_0 = 59$ (1er mars) au printemps, ou à $j_0 = 273$ (1er octobre) à l'automne.

Chaque type de cerisier possède une **fenêtre de sensibilité** $[v, h)$ : de la véraison $v$ (les fruits deviennent attractifs et pondables) à la récolte $h$.

| Type | Véraison $v$ | Récolte $h$ | Dates |
|---|---|---|---|
| Précoce | 130 | 158 | 10 mai → 7 juin |
| Saison | 150 | 178 | 30 mai → 27 juin |
| Tardive | 168 | 200 | 17 juin → 19 juillet |

```diagram-phenologie
```

C'est **le cœur du raisonnement agronomique** : la population croît tout le printemps et culmine en été. Une variété précoce est récoltée avant le pic, alors qu'une variété tardive mûrit en plein pic.

## 4. Forçage climatique

### 4.1 Température journalière

$$
T(j) = 12{,}5 + 10{,}5 \,\sin\!\left(\frac{2\pi\,(j - 110)}{365}\right) + \Delta_{climat}(j)
$$

Sans correction, cela donne environ 2 °C mi-janvier et 23 °C mi-juillet. Les profils ajoutent :

| Profil | Correction $\Delta_{climat}$ | Mortalité hivernale additionnelle $\mu_{hiv}$ | Autres effets |
|---|---|---|---|
| Hiver doux | +3,5 °C en hiver ($j<60$ ou $j>320$) | 0,016 /j | — |
| Hiver rigoureux | −4 °C en hiver | 0,050 /j | — |
| Printemps humide | −0,5 °C de $j=80$ à 180 | 0,028 /j | ponte × 1,25 ; rémanence des traitements × 0,6 |
| Été caniculaire | +5 °C de $j=160$ à 250 | 0,028 /j | ponte freinée et mortalité accrue au-delà de 30 °C |

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

Le passage œuf → adulte nécessite environ **210 degrés-jours au-dessus de 8 °C**. La fraction d'immatures qui émerge chaque jour vaut :

$$
\delta(T) = \min\!\left(1,\; \frac{\max(0,\,T-8)}{210}\right)
$$

Par exemple, à 22 °C on obtient $\delta = 14/210$, soit environ **15 jours** de développement.

## 5. Ressource et attractivité

### 5.1 Ressource pour la ponte (ρ)

- **Espace naturel** (ronces, sureau, lierre…) :
$$
\rho_{nat}(j) = \begin{cases} 0{,}05 & j < 95 \\ 0{,}12 + 0{,}28\,\max\!\left(0,\sin\frac{\pi (j-95)}{270}\right) & \text{sinon} \end{cases}
$$
- **Cerisier** :
  - avant véraison : $\rho = 0{,}02$ ;
  - pendant la fenêtre $[v,h)$ : $\rho = 1$ (les fruits sont pondables et donc endommageables) ;
  - le jour $h$ de la récolte : les fruits non cueillis deviennent des **résidus** $R_c$ (voir *Prophylaxie*) ;
  - après récolte : $R_c \leftarrow 0{,}965\,R_c$ chaque jour (pourriture, dessèchement) et $\rho = 1{,}4\,R_c + 0{,}02$.
- **Zone neutre** : $\rho = 0{,}003$.

### 5.2 Attractivité pour la dispersion (w)

| Case | $w_c$ |
|---|---|
| Espace naturel | $0{,}6 + \rho_{nat}(j)$ |
| Cerisier, de $v-5$ à $h$ | **3** (fruits mûrissants très attractifs) |
| Cerisier après récolte | $0{,}3 + 3\,R_c$ |
| Cerisier hors saison | 0,25 |
| Zone neutre | 0,15 |

## 6. Le pas de temps journalier

```diagram-pas-de-temps
```

Chaque jour, dans cet ordre :

1. **Climat** : calcul de $T$, $\varphi(T)$, $\delta(T)$, $\rho_{nat}$.
2. **Traitements** : déclenchement éventuel par parcelle (voir *Les leviers*).
3. **Pré-calcul** : attractivité $w_c$ et efficacité du filet actif $\eta_c$ de chaque case.
4. **Dynamique locale** (ponte, dégâts, développement, mortalité), case par case.
5. **Dispersion** des adultes vers les 8 voisines.
6. **Bilan** : mise à jour des pics, enregistrement des récoltes, échantillonnage des séries tous les 3 jours.

### 6.1 Ponte

$$
E_c = A_c \times \underbrace{6}_{\text{œufs / femelle / jour (max.)}} \times \varphi(T) \times \rho_c \times (1-\eta_c) \times \tau_c \times \left(1 - \frac{A_c}{K_c}\right)^{\!+} \times h_{hum}
$$

- $\eta_c$ : efficacité du filet actif (0 si aucun filet) ;
- $\tau_c$ : fraction de pontes fertiles (TIS) ;
- $K_c$ : capacité d'accueil : **260** femelles/case en espace naturel, **700** en cerisier, **8** en zone neutre. Le terme $(1 - A/K)^+$ est une densité-dépendance logistique sur la ponte ;
- $h_{hum} = 1{,}25$ en printemps humide, 1 sinon.

### 6.2 Dégâts sur fruits

Pendant la fenêtre de sensibilité seulement, chaque œuf pondu peut endommager un fruit sain :

$$
H_c \leftarrow H_c \times \exp\!\left(-\frac{E_c}{3\,500}\right)
$$

Cette forme exponentielle (loi de Poisson) traduit le fait que les œufs se répartissent au hasard sur les fruits : les premiers œufs abîment des fruits sains, les suivants tombent de plus en plus souvent sur des fruits déjà touchés. La constante 3 500 représente le nombre d'« œufs efficaces » nécessaire pour faire chuter la fraction saine à $e^{-1} \approx 37\,\%$ sur une case.

Le jour de la récolte $h$, la **récolte saine de la parcelle** est la moyenne de $H_c$ sur ses cases. C'est la valeur affichée (en %), moyennée sur les années simulées.

### 6.3 Immatures

$$
L_c \leftarrow L_c + \sigma_c\,E_c, \qquad
\text{Émergence} = \delta(T)\,L_c, \qquad
L_c \leftarrow L_c - \delta(T)\,L_c - \mu_L\,L_c
$$

- survie larvaire de base $\sigma_c = 0{,}30$ (réduite par les parasitoïdes) ;
- mortalité des immatures $\mu_L = 0{,}012$ /j, ou 0,03 /j si $T < 5$ °C.

### 6.4 Adultes

$$
A_c \leftarrow A_c\,(1 - \mu_c) + \text{Émergence}, \qquad A_c \le 1{,}3\,K_c
$$

avec une mortalité journalière plafonnée à 0,95 :

$$
\mu_c = \underbrace{0{,}028}_{\text{base}} + \underbrace{0{,}035\,[T>30]}_{\text{chaleur}} + \underbrace{\mu_{hiv}\,[T<6] \times (0{,}5 \text{ en forêt})}_{\text{froid}} + \underbrace{0{,}04\,[\text{neutre}]}_{\text{milieu hostile}} + \underbrace{\kappa_p\,[\text{traitement actif}]}_{\text{traitement}}
$$

Une mortalité de base de 2,8 % par jour correspond à une **espérance de vie adulte d'environ 36 jours**. L'abri forestier divise la mortalité hivernale par deux, ce qui fait de l'espace naturel le **réservoir d'hivernage**.

### 6.5 Dispersion

Chaque jour, une fraction $D$ des femelles quitte sa case :

$$
D = \begin{cases} 0{,}12 & T > 10\,^\circ\text{C} \\ 0{,}03 & \text{sinon} \end{cases}
$$

Les émigrantes se répartissent entre les **8 voisines** (voisinage de Moore) au prorata de leur attractivité. La part refoulée par un filet revient dans la case de départ :

$$
\text{reçu}_n = D\,A_c \,\frac{w_n}{\sum_{m \in V(c)} w_m}\,(1 - 0{,}7\,\eta_n), \qquad
\text{refoulé} = \sum_n D\,A_c\,\frac{w_n}{\sum w}\,0{,}7\,\eta_n
$$

```diagram-voisinage
```

À l'échelle du verger, cette règle produit un **flux orienté** : au printemps les adultes « coulent » de l'espace naturel vers les cerisiers en véraison, puis d'une variété à l'autre au fil des maturités, puis reviennent vers les refuges ou les résidus après la récolte.

## 7. Initialisation

| Case | Départ printemps | Départ automne |
|---|---|---|
| Espace naturel | 12 femelles/case (1 200 /ha) | 30 /case (3 000 /ha) |
| Cerisier | 0,05 /case | 0,05 /case |
| Neutre | 0 | 0 |

Un verger **sans aucun espace naturel** démarre donc avec une population très faible, qui doit s'installer à partir des quelques individus présents dans les cerisiers. Le modèle reproduit ainsi qualitativement l'effet protecteur de l'absence de refuge.

## 8. Sorties calculées

| Sortie | Définition |
|---|---|
| Récolte saine par parcelle (%) | $\overline{H}$ le jour de récolte, moyenne sur les années |
| Récolte globale (%) | moyenne des parcelles de cerisiers pondérée par leur surface |
| Pic de femelles/ha | $\max_t$ de la densité, toutes cases de cerisier confondues |
| Carte de pression | $P_c = \max_t A_c \times 10\,000/S_c$ pour chaque case |
| Séries temporelles | densité moyenne par parcelle (et moyenne forêt / cerisiers), % de fruits sains, tous les 3 jours |
| Événements | dates des traitements, poses de filets, récoltes, lâchers |

## 9. Tableau récapitulatif des paramètres

| Paramètre | Valeur | Rôle |
|---|---|---|
| Fécondité max | 6 œufs/♀/j | ponte |
| Seuils de ponte | 10 °C / 20-26 °C / 33 °C | aptitude thermique |
| Développement | 210 DJ > 8 °C | durée œuf → adulte |
| Survie larvaire | 0,30 | fraction d'œufs atteignant l'émergence (hors mortalité journalière) |
| Mortalité immatures | 0,012 /j (0,03 si T < 5 °C) | — |
| Mortalité adultes | 0,028 /j | ≈ 36 j de vie |
| Surmortalité chaleur | +0,035 /j si T > 30 °C | été caniculaire |
| Surmortalité zone neutre | +0,04 /j | milieu hostile |
| Capacités d'accueil $K$ | 260 / 700 / 8 par case | forêt / cerisier / neutre |
| Dispersion | 12 %/j (3 % si T ≤ 10 °C) | 8 voisines |
| Constante de dégâts | 3 500 œufs | courbe de Poisson |
| Décroissance des résidus | ×0,965 /j | demi-vie ≈ 20 j |
