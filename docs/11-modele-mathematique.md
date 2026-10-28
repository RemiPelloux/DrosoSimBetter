---
title: Spécification du moteur
icon: code
---

# Spécification mathématique du moteur

Le chapitre [Le modèle biologique](03-modele.md) est une **visite guidée** : il explique *pourquoi* chaque mécanisme existe. Ce chapitre-ci est la **spécification de référence**, destinée à qui veut réimplémenter le moteur, le calibrer ou en discuter les hypothèses : chaque symbole, chaque constante, chaque formule, dans l'ordre exact du calcul.

> **Règle en cas de désaccord** : le code (`src/lib/engine.ts`) fait foi ; si une formule ci-dessous diverge, c'est la documentation qu'il faut corriger.

## 0. Forme générale

Le modèle est un **système dynamique déterministe, spatialisé, à temps discret journalier** :

$$
\mathbf{S}_{t+1} = \mathcal{D}_t \circ \mathcal{G}_t^{(\kappa_t)}\big(\mathbf{S}_t\big),
\qquad
\mathbf{S}_t = \big(A_c(t),\, L_c(t),\, H_c(t),\, R_c(t)\big)_{c \in \mathcal{C}}
$$

- $c \in \mathcal{C}$ : cases de la grille, $|\mathcal{C}| = 400$ ;
- $\mathcal{G}$ : opérateur **local** (ponte, dégâts, développement, mortalité), case par case ;
- $\mathcal{D}$ : opérateur de **dispersion** (8 voisines, conservatif) ;
- $\kappa_t$ : mortalité additionnelle due à un traitement **actif** ce jour-là, calculée sur $\mathbf{S}_t$ *avant* $\mathcal{G}$ ;
- les leviers $u$ ne sont pas des coefficients de sortie : ils entrent dans $\mathcal{G}$, $\mathcal{D}$ et $\kappa$ ;
- **aucun aléa** : deux appels identiques produisent des sorties identiques au bit près (vérifié par `npm run test:engine`).

Chaque stratégie — témoin compris — est une **trajectoire indépendante** sur la même grille et le même climat.

## 1. Domaine, unités, conversions

| Grandeur | Valeur par défaut | Code |
|---|---|---|
| Taille de grille | $N = 20$, $N^2 = 400$ cases | `N`, `NC` |
| Surface d'une case $S_c$ | 100 m² (0,01 ha) → grille = 4 ha | `eco.cellAreaM2` |
| Conversion densité | $\text{femelles/ha} = A_c \times 10^4 / S_c$ | `toHa` |
| Rendement | 10 t/ha | `eco.yieldTPerHa` |
| Prix | 3,50 €/kg | `eco.pricePerKg` |
| Pas de temps | 1 jour | — |
| Horizon | 1 à 3 ans | `params.durationYears` |

Voisinage de **Moore** (8 cases), pré-calculé en liste compressée (`nbrStart` + `nbr`) ; les bords sont **réfléchissants** (aucun flux hors grille).

## 2. Temps et calendrier

Le jour de l'année (DOY) est $j \in [0, 364]$, $j = 0$ au 1er janvier.

$$
j(t) = (j_0 + t) \bmod 365,
\qquad
j_0 = \begin{cases} 59 & \text{départ printemps (1er mars)} \\ 273 & \text{départ automne (1er octobre)} \end{cases}
$$

$$
T_{tot} = 365\,N_{ans} + 92\cdot[\,j_0 = 273\,]
$$

Les 92 jours supplémentaires du départ automne servent à couvrir $N_{ans}$ saisons de récolte **complètes** (l'hiver initial est inclus mais ne compte pas comme une année de récolte).

Indices utiles :

$$
a(t) = \left\lfloor \frac{j_0 + t}{365} \right\rfloor,
\qquad
n_{saison}(t) = \max\!\big(0,\; a(t) - [\,j_0 = 273\,]\big)
$$

$n_{saison}$ est le nombre d'années de saison écoulées : il pilote la montée en charge des parasitoïdes.

## 3. Forçage climatique

### 3.1 Température

$$
T(j) = 12{,}5 + 10{,}5\,\sin\!\left(\frac{2\pi\,(j-110)}{365}\right) + \Delta_{p}(j)
$$

| Profil $p$ | $\Delta_p$ | $\mu_{hiv}$ | Autre |
|---|---|---|---|
| `mild-winter` — Hiver doux | $+3{,}5$ si $j<60$ ou $j>320$ | 0,016 | — |
| `harsh-winter` — Hiver rigoureux | $-4$ idem | 0,050 | — |
| `humid-spring` — Printemps humide | $-0{,}5$ si $80<j<180$ | 0,028 | ponte $\times 1{,}25$ ; rémanence des traitements $\times 0{,}6$ |
| `dry-summer` — Été caniculaire | $+5$ si $160<j<250$ | 0,028 | mortalité $+0{,}035$ si $T>30$ |

**Plages réellement atteintes** (calculées sur les paramètres actuels) :

| Profil | $T_{\min}$ | $T_{\max}$ | Jours $T<6$ °C | Jours $T>30$ °C |
|---|---|---|---|---|
| hiver doux | 6,0 | 23,0 | 48 | 0 |
| hiver rigoureux | −1,4 | 23,0 | 116 | 0 |
| printemps humide | 2,0 | 23,0 | 105 | 0 |
| été caniculaire | 2,5 | **28,0** | 105 | **0** |

> **Conséquence à connaître** : avec ces paramètres, $T$ ne dépasse jamais 30 °C, donc le terme $+0{,}035\,[T>30]$ n'est **jamais activé** et la branche haute de $\varphi$ (au-delà de 26 °C) ne sert qu'en été caniculaire. Une calibration sur météo réelle rendra ces deux termes actifs.

### 3.2 Aptitude thermique de la ponte

$$
\varphi(T) = \begin{cases}
0 & T \le 10 \ \text{ou}\ T \ge 33\\[2pt]
\dfrac{T-10}{10} & 10 < T < 20\\[4pt]
1 & 20 \le T \le 26\\[2pt]
\dfrac{33-T}{7} & 26 < T < 33
\end{cases}
$$

### 3.3 Vitesse de développement (degrés-jours)

$$
\delta(T) = \min\!\left(1,\ \frac{\max(0,\;T-8)}{210}\right)
$$

210 degrés-jours au-dessus de 8 °C ≈ **15 jours** œuf → adulte à 22 °C. Cumul annuel du modèle : ≈ 2 190 DJ (soit ≈ 10 générations théoriques, largement chevauchantes), dont ≈ 1 070 DJ entre le 1er mars et le 20 juillet, soit ≈ 5 générations sur la période de récolte.

### 3.4 Ressource sauvage

$$
\rho_{nat}(j) = \begin{cases}
0{,}05 & j < 95\\[2pt]
0{,}12 + 0{,}28\,\max\!\left(0,\ \sin\dfrac{\pi\,(j-95)}{270}\right) & j \ge 95
\end{cases}
$$

## 4. Phénologie

Fenêtre de sensibilité $[v, h)$ : de la **véraison** (fruits pondables et donc endommageables) à la **récolte**.

| Type | Code | $v$ | $h$ | Dates |
|---|---|---|---|---|
| Cerise précoce | `early-cherry` | 130 | 158 | 10 mai → 7 juin |
| Cerise de saison | `season-cherry` | 150 | 178 | 30 mai → 27 juin |
| Cerise tardive | `late-cherry` | 168 | 200 | 17 juin → 19 juil. |

Ces six nombres sont utilisés **partout** : ressource, attractivité, DAR des traitements, pose des filets, date de récolte. La phénologie est fixe d'une année sur l'autre (pas de lien avec la température).

## 5. Ressource $\rho$, attractivité $w$, capacité $K$

| Case | Phase | $\rho_c$ | $w_c$ | $K_c$ |
|---|---|---|---|---|
| Zone neutre | toujours | 0,003 | 0,15 | 8 |
| Espace naturel | toujours | $\rho_{nat}(j)$ | $0{,}6 + \rho_{nat}(j)$ | 260 |
| Cerisier | $j < v$ | 0,02 | 0,25 | 700 |
| Cerisier | $v-5 \le j < v$ | 0,02 | **3** | 700 |
| Cerisier | $v \le j < h$ | **1** | **3** | 700 |
| Cerisier | $j = h$ | 0,003 | 0,25 | 700 |
| Cerisier | $j > h$ | $1{,}4\,R_c + 0{,}02$ | $0{,}3 + 3\,R_c$ | 700 |

> **Discontinuité du jour de récolte.** Le jour $j = h$ n'appartient ni à la fenêtre $[v,h)$ ni au « après récolte » : la ressource retombe à 0,003 et l'attractivité à 0,25 pendant 24 h. C'est un effet de bord de l'implémentation (pas une hypothèse biologique) ; il est invisible sur les courbes mais doit être connu avant toute calibration.

**Résidus post-récolte.** Le jour même de la récolte, on fixe

$$
R_c \leftarrow \underbrace{(1 - r_h)}_{\text{fruits non cueillis}} \times
\begin{cases}
0{,}25 & \text{prophylaxie \& destruction au sol}\\
1 & \text{sinon}
\end{cases}
$$

avec $r_h = 0{,}80$ par défaut, ou `harvestRate`/100 si la prophylaxie est active. Puis, chaque jour suivant :

$$
R_c \leftarrow 0{,}965\,R_c \qquad (\text{demi-vie} \approx 19{,}5\ \text{jours})
$$

Les résidus restent attractifs et pondables : c'est le **rebond post-récolte**, et la raison pour laquelle la prophylaxie agit sur l'année suivante autant que sur l'année en cours.

## 6. Opérateur local $\mathcal{G}$

Pour chaque case $c$, dans cet ordre exact :

```ts
const dd = a < K ? 1 - a / K : 0;                       // densité-dépendance
const eggs = a * 6 * suit * res * (1 - net) * (tisOn ? tisF : 1) * dd * humidF;

if (fruit && eggs > 0) healthy *= Math.exp(-eggs / 3500); // dégâts, avant tout le reste

larvae += eggs * larvS;                                  // survie larvaire
const emerge = larvae * devC;                            // émergence (degrés-jours)
larvae = larvae - emerge - larvae * larvMort;

let mort = baseMort;                                     // 0.028
if (cold) mort += winterMortExtra * (kind === forest ? 0.5 : 1);
if (kind === neutral) mort += 0.04;
if (treatRemain[parcel] > 0) mort += treatKill[parcel];
if (mort > 0.95) mort = 0.95;

a = a * (1 - mort) + emerge;
if (a > K * 1.3) a = K * 1.3;
```

### 6.1 Ponte

$$
E_c = A_c \cdot 6 \cdot \varphi(T) \cdot \rho_c \cdot (1-\eta_c) \cdot \tau_c \cdot \left(1 - \frac{A_c}{K_c}\right)^{\!+} \cdot h_{hum}
$$

| Terme | Sens | Valeur |
|---|---|---|
| $6$ | fécondité maximale | 6 œufs ♀⁻¹ j⁻¹ |
| $\eta_c$ | efficacité du filet actif | 0 ; 0,95 (monorang) ; 0,85 (monoparcelle) |
| $\tau_c$ | fertilité des pontes (TIS) | $1$, ou $1/(1+0{,}12\,r)$ hors fenêtre TIS |
| $h_{hum}$ | printemps humide | 1,25 ou 1 |
| $(\cdot)^+$ | compétition pour la ressource | plafonne la ponte à $A = K$ |

La densité-dépendance porte **uniquement sur la ponte** : les adultes peuvent dépasser $K$ (jusqu'à $1{,}3K$) sans que leur survie en soit affectée.

### 6.2 Dégâts sur fruits

Pendant la fenêtre $[v, h)$ seulement :

$$
H_c \leftarrow H_c \cdot \exp\!\left(-\frac{E_c}{3\,500}\right)
\;\Longrightarrow\;
H_c(T) = \exp\!\left(-\frac{1}{3\,500}\sum_{t} E_c(t)\right)
$$

Loi de Poisson : les œufs se répartissent au hasard, donc les derniers tombent de plus en plus souvent sur des fruits déjà piqués. Interprétation de la constante : **2 426 œufs cumulés dans une case** (≈ 24 œufs/m², soit 243 000/ha) font tomber la fraction saine à 50 %.

À saturation ($A=K=700$, plein été), $E$ atteint plusieurs milliers d'œufs par jour : une case peut être perdue en **une seule journée**, ce qui rend le pic estival très tranchant.

### 6.3 Immatures

$$
L_c \leftarrow L_c + \sigma_c E_c, \qquad
L_c \leftarrow L_c\,(1 - \delta) - \mu_L L_c
$$

- $\sigma_c$ : survie larvaire, base 0,30, réduite par les parasitoïdes ;
- $\mu_L$ : 0,012 j⁻¹, ou 0,03 j⁻¹ si $T < 5$ °C ;
- l'émergence n'est **pas** structurée en âges : une fraction journalière sort du compartiment, ce qui étale les générations (≈ développement exponentiel plutôt que file d'attente).

### 6.4 Adultes

$$
A_c \leftarrow A_c\,(1-\mu_c) + \delta\,L_c,
\qquad A_c \le 1{,}3 K_c
$$

$$
\mu_c = 0{,}028 + 0{,}035\,[T>30] + \underbrace{\mu_{hiv}\,[T<6] \times (0{,}5 \text{ en espace naturel})}_{\text{froid}} + 0{,}04\,[\text{neutre}] + \kappa_p
$$

$\mu_c$ est plafonnée à 0,95. Espérance de vie de base : $1/0{,}028 \approx 36$ jours.

**Survie hivernale résultante** (nombre de jours $T<6$ du modèle, cumulés) :

| Profil | Jours $T<6$ | Survie hiver, plein champ | Survie hiver, espace naturel |
|---|---|---|---|
| Hiver doux | 48 | ≈ 12 % | ≈ 18 % |
| Printemps humide / base | 105 | ≈ 0,3 % | ≈ 1,2 % |
| Hiver rigoureux | 116 | ≈ 0,02 % | ≈ 0,2 % |

C'est le mécanisme qui explique l'essentiel de l'écart entre profils climatiques, et le rôle de refuge de l'espace naturel (facteur 0,5 sur la surmortalité hivernale).

## 7. Dispersion $\mathcal{D}$

Fraction émigrante :

$$
D = \begin{cases} 0{,}12 & T > 10\ ^\circ\text{C}\\ 0{,}03 & \text{sinon}\end{cases}
$$

Pour chaque case source $c$, avec $V(c)$ le voisinage de Moore et $w$ l'attractivité :

$$
\Phi_n = D\,A_c \cdot \frac{w_n}{\sum_{m \in V(c)} w_m},
\qquad
\text{reçu}_n = \Phi_n\,(1 - 0{,}7\,\eta_n),
\qquad
\text{refoulé} = \sum_{n} \Phi_n \cdot 0{,}7\,\eta_n
$$

$$
A_n \leftarrow A_n + \text{reçu}_n,
\qquad
A_c \leftarrow A_c - D A_c + \text{refoulé}
$$

Propriétés à retenir :

- **conservatif** : aucune perte d'individus dans la dispersion, les immigrants refusés par un filet rentrent chez eux (bords réfléchissants inclus) ;
- si $\sum_m w_m = 0$ (voisinage entièrement neutre), la case ne disperse pas ;
- le filtre du filet s'applique à l'**arrivée** : une femelle sort librement d'une parcelle filetée, elle n'y rentre pas (asymétrie voulue, à discuter) ;
- le flux est **orienté par l'attractivité**, donc pas une diffusion isotrope : au printemps il descend de l'espace naturel vers les cerisiers en véraison, puis de variété en variété, puis revient vers les refuges.

Ordre de grandeur (marche aléatoire non biaisée équivalente, case de 10 m) : déplacement quadratique moyen $\approx 0{,}12 \times 1{,}5\,t$ cases², soit un écart-type $\approx 4{,}2\sqrt{t}$ m — ≈ 23 m en 30 jours. En pratique plus lent, puisque l'attractivité concentre les flux.

## 8. Traitements ($\kappa$)

Un traitement n'est déclenché que si le levier est actif sur une parcelle de cerisier, et si **toutes** ces conditions sont réunies :

```
véraison − 3  ≤  j  ≤  récolte − 3          (respect du délai avant récolte)
nb_passages(année)  <  treatmentPasses
t − dernier_passage  ≥  7 jours
déclencheur satisfait
```

Déclencheur `calendar` — les passages sont répartis uniformément sur la fenêtre :

$$
\text{slot}_k = v + \left\lfloor \frac{(h - 3 - v)\;k}{n} \right\rceil,
\qquad k = 0, \dots, n-1
$$

Déclencheur `threshold` — seuil de piégeage traduit en densité moyenne de la parcelle :

$$
\frac{1}{|P|}\sum_{c \in P} A_c \cdot \frac{10^4}{S_c} > 1\,500\ \text{femelles/ha}
$$

Effet d'un passage :

$$
\kappa_p = \begin{cases} 0{,}32 & \text{conventionnel}\\ 0{,}16 & \text{biocontrôle}\end{cases}
\qquad
\text{rémanence} = \begin{cases} 7\ \text{j} & \text{conv.}\\ 4\ \text{j} & \text{bio}\end{cases} \times \begin{cases} 0{,}6 & \text{printemps humide}\\ 1 & \text{sinon}\end{cases}
$$

**Limites explicites** : le traitement ne touche que les **adultes** (pas les immatures), et $\kappa$ s'applique à toutes les cases de la parcelle, quelle que soit leur population.

L'IFT ne compte que les passages **réellement déclenchés** en conventionnel :

$$
\text{IFT} = \frac{1}{N_{ans}} \cdot \frac{\sum_{\text{passages conv.}} |P|}{|P_{\text{cerisiers}}|}
$$

c'est-à-dire le nombre moyen de passages conventionnels par hectare de cerisier et par an. Le **coût** phyto, lui, est calculé sur `treatmentPasses` déclaré : avec un déclencheur `threshold` qui traite moins que prévu, le coût est donc surestimé par rapport aux passages réels.

## 9. Les cinq leviers dans les équations

| Levier | Paramètre | Entre dans | Effet exact |
|---|---|---|---|
| **Filet** | `netType` ∈ {monorang, monoparcelle} | $\eta_c$ | 0,95 / 0,85 |
| | `netDeploy` ∈ {bloom, veraison} | date | actif de $j=105$ (floraison) ou $v-5$, jusqu'à $h+5$ |
| | — | $\mathcal{D}$ | refoule 70 % de la fraction reçue |
| **Prophylaxie** | `harvestRate` (80→98) | $r_h$ | fruits non cueillis 20 % → 2 % |
| | `groundFruitDestruction` | $R_c$ | résidus ×0,25 |
| **Traitement** | `treatmentMode`, `passes`, `trigger` | $\kappa_p$ | cf. §8 |
| **Parasitoïdes** | `parasitoidDose` ∈ {standard, reinforced} | $\sigma_c$ | voir ci-dessous |
| | `parasitoidSeason` ∈ {spring, autumn} | date | lâcher $j=100$ ou $j=280$ |
| **TIS** | `tisRatio` $r \in [5, 20]$ | $\tau_c$ | $\tau = 1/(1+0{,}12\,r)$, actif $80 \le j \le 260$ |

Survie larvaire avec parasitoïdes :

$$
\sigma_c = 0{,}30 \times \Big[1 - \min\big(0{,}75,\ 0{,}38 \cdot \min(1,\ 0{,}35 + 0{,}33\,n_{saison}) \cdot d\big)\Big],
\qquad d = \begin{cases}1 & \text{standard}\\ 1{,}4 & \text{renforcé}\end{cases}
$$

L'effet est **cumulatif dans le temps** ($n_{saison}$ = nombre de saisons écoulées) et **plafonné à 75 %** : un lâcher ne peut pas éteindre la population, seulement la réduire.

TIS : $\tau = 1/(1+0{,}12r)$ donne $\tau = 0{,}625$ à $r=5$ et $\tau = 0{,}294$ à $r=20$ — mais **seulement entre les jours 80 et 260** ; hors fenêtre, la TIS n'a aucun effet, même activée.

## 10. Conditions initiales

$$
A_c(0) = \begin{cases}
30 & \text{espace naturel, départ automne}\\
12 & \text{espace naturel, départ printemps}\\
0{,}05 & \text{cerisier}\\
0 & \text{zone neutre}
\end{cases}
\qquad
L_c(0) = 0,\quad H_c(0) = 1,\quad R_c(0) = 0
$$

$H$ est réinitialisé à 1 à chaque 1er janvier ($j = 0$ en cours de simulation).

## 11. Sorties

| Sortie | Définition | Notes |
|---|---|---|
| Séries | tous les 3 jours : $A_c \cdot 10^4/S_c$ moyenné par parcelle, plus `forest_all` et `cherry_all` | 1 point = 1 label « 12 juin A2 » |
| Fruits sains | $100 \times \overline{H}_P$ le jour $j = h$ de chaque parcelle | moyenne sur les années |
| Récolte globale | moyenne des parcelles de cerisier pondérée par le nombre de cases | 100 si aucun cerisier |
| Pic | $\max_{t,c \in \text{cerisiers}} A_c(t)\cdot 10^4/S_c$ | ♀/ha |
| Carte de pression | $P_c = \max_t A_c(t)\cdot 10^4/S_c$ | `peakByCell`, une valeur par case |
| Événements | traitements, filets, récoltes, lâchers, TIS | datés en jours absolus |
| IFT | cf. §8 | arrondi à 0,1 |
| Coûts, CA, heures | cf. §12 | annuels |

Sont aussi produits `harvestByParcelYear` (une valeur par année et par parcelle) et `computeMs` (durée de calcul, utile en test).

## 12. Économie

Les coûts sont **annuels** et forfaitaires par hectare, calculés sur les leviers déclarés (pas sur les événements) :

$$
C_{\text{filet}} = S_P \, c_{\text{filet}} \qquad
C_{\text{phyto}} = S_P \cdot n \cdot c_{\text{mode}} \qquad
C_{\text{bio}} = S_P \, c_{\text{parasitoïde}} \qquad
C_{\text{TIS}} = S_P \, c_{\text{TIS}}
$$

avec, en €/ha/an : $c_{\text{filet}} = 3\,800$ (monorang) ou $2\,600$ (monoparcelle) ; $c_{\text{mode}} = 85$ par passage conventionnel, $150$ en biocontrôle ; $c_{\text{parasitoïde}} = 300$ (standard) ou $520$ (renforcé) ; $c_{\text{TIS}} = 950$. $S_P$ est la surface de la parcelle en hectares, $n$ le nombre de passages déclaré.

Travail (16 €/h) : filet 40 h/ha ; prophylaxie 90 h/ha si `harvestRate` ≥ 95 sinon 55, + 25 h/ha de destruction au sol ; traitement 1,5 h/passage/ha.

Chiffre d'affaires, par an, sommé sur les parcelles de cerisier :

$$
\text{CA} = \sum_{P} S_P \cdot Y \cdot 1000 \cdot p \cdot \frac{\overline{H}_P}{100}
$$

avec $Y = 10$ t/ha et $p = 3{,}5$ €/kg (le facteur 1 000 convertit les tonnes en kilos).

Indicateurs dérivés, calculés dans l'interface et non dans le moteur :

$$
\text{CA sauvé} = \text{CA}(\text{stratégie}) - \text{CA}(\text{témoin}),
\qquad
\text{Bilan net} = \text{CA sauvé} - C_{\text{total}},
\qquad
\text{ROI} = \frac{\text{CA sauvé}}{C_{\text{total}}}
$$

## 13. Implémentation numérique

| Choix | Raison |
|---|---|
| Tableaux typés (`Float64Array`, `Float32Array`, `Int16Array`, `Int32Array`) | zéro allocation dans la boucle chaude, cache-friendly |
| Voisinage pré-calculé (`nbrStart`, `nbr`) | évite 8 tests de bord par case et par jour |
| Parcours des cases dans l'ordre mémoire | localité, pas de dépendance entre cases dans $\mathcal{G}$ |
| `nextA` puis `A.set(nextA)` | dispersion de type Jacobi : les sorties du jour ne nourrissent pas les entrées du même jour |
| Aucun `Math.random` | déterminisme total, tests reproductibles |
| Parcelles détectées par composantes 4-connexes, mémoïsées par `WeakMap` sur la référence de grille | la grille est immuable (chaque édition crée un nouveau tableau) → un seul calcul partagé |
| Exécution dans un Web Worker (`sim.worker.ts`) | l'interface reste fluide pendant le recalcul |

Complexité : $\mathcal{O}(T_{tot} \cdot |\mathcal{C}|)$ en temps (≈ 292 000 mises à jour de case pour 2 ans), $\mathcal{O}(|\mathcal{C}|)$ en mémoire d'état, plus les séries. L'ordre de grandeur mesuré est de quelques dizaines de millisecondes pour trois stratégies sur deux ans.

## 14. Comportements émergents

Ces régularités ne sont pas codées en dur : elles **sortent** des équations ci-dessus, et servent de test de non-régression (`npm run test:engine`).

| Comportement attendu | Observé |
|---|---|
| Les variétés précoces échappent au pic estival | témoin an 1 : précoce ≈ 98 %, tardive ≈ 47 % |
| Un hiver rigoureux réduit la pression | survie hivernale ≈ 0 % contre 12 % en hiver doux |
| Un printemps humide l'aggrave | récolte témoin ≈ 27 % contre 30 % |
| Les traitements seuls s'épuisent | tardive protégée ≈ 79 % (an 1) → ≈ 6 % (an 3) |
| Prophylaxie et parasitoïdes agissent à retardement | effet faible an 1, croissant ensuite |
| Le filet domine sur la récolte saine | ≈ 99 %, toutes variétés |
| Sans refuge, l'infestation démarre très bas | population initiale quasi nulle |

## 15. Protocole de calibration

Les paramètres ne sont pas calibrés (voir [Limites & calibration](07-limites.md)). Ordre de priorité, du plus rentable au plus fin :

1. **Météo réelle** — remplacer `temperature(j, profile)` par une série journalière. Cela active les termes aujourd'hui inertes ($T>30$, branches hautes de $\varphi$) et rend les mortalités hivernales crédibles.
2. **Phénologie locale** — remplacer les six valeurs de `PHENOLOGY` par les dates observées des variétés suivies.
3. **Dynamique** — ajuster fécondité (6), $\mu$ (0,028), $\sigma$ (0,30), $D$ (0,12) sur des **courbes de piégeage** converties en densité relative ; vérifier en priorité la position temporelle du pic.
4. **Dégâts** — ajuster la constante 3 500 pour que $\overline{H}$ simulé rejoigne les taux de fruits piqués observés.
5. **Leviers** — $\eta$ (filets), $\kappa$ et rémanence (traitements), montée en charge des parasitoïdes, $\tau$ (TIS), à partir d'essais publiés.
6. **Validation** — garder une année ou un site hors calibration, puis comparer.

Après chaque modification : `npm run test:engine` (12 vérifications, dont déterminisme et bornes physiques) puis comparaison des exports CSV.

## 16. Annexe — table maître des paramètres

| Paramètre | Symbole | Valeur | Unité | Emplacement |
|---|---|---|---|---|
| Taille de grille | $N$ | 20 (400 cases) | — | `N`, `NC` |
| Surface de case | $S_c$ | 100 | m² | `economics.cellAreaM2` |
| Fécondité max | — | 6 | œufs ♀⁻¹ j⁻¹ | boucle `G` |
| Aptitude ponte | $\varphi$ | 10 / 20–26 / 33 | °C | `tempSuitability` |
| Développement | — | 210 | DJ > 8 °C | boucle `G` |
| Survie larvaire | $\sigma$ | 0,30 | — | `larvS` |
| Mortalité immatures | $\mu_L$ | 0,012 (0,03 si $T<5$) | j⁻¹ | boucle `G` |
| Mortalité adultes | $\mu$ | 0,028 | j⁻¹ | `baseMort` |
| Surmortalité chaleur | — | +0,035 si $T>30$ | j⁻¹ | boucle `G` |
| Surmortalité hiver | $\mu_{hiv}$ | 0,016 / 0,028 / 0,050 | j⁻¹ | `winterMortExtra` |
| Surmortalité zone neutre | — | +0,04 | j⁻¹ | boucle `G` |
| Plafond de mortalité | — | 0,95 | j⁻¹ | boucle `G` |
| Capacités | $K$ | 260 / 700 / 8 | ind./case | boucle `G` |
| Plafond de densité | — | $1{,}3K$ | ind./case | boucle `G` |
| Dispersion | $D$ | 0,12 (0,03 si $T\le10$) | j⁻¹ | boucle `D` |
| Blocage par filet | — | 0,7 | — | boucle `D` |
| Efficacité filet | $\eta$ | 0,95 / 0,85 | — | `netE` |
| Constante de dégâts | — | 3 500 | œufs/case | boucle `G` |
| Décroissance des résidus | — | 0,965 | j⁻¹ | boucle `G` |
| Résidus après récolte | $R_0$ | 0,20 (0,02 avec prophylaxie) | — | `residAfter` |
| Seuil de traitement | — | 1 500 | ♀/ha | déclencheur `threshold` |
| Efficacité traitement | $\kappa$ | 0,32 / 0,16 | j⁻¹ | `treatKill` |
| Rémanence | — | 7 j / 4 j (× 0,6 si humide) | j | `treatRemain` |
| Intervalle minimal | — | 7 | j | boucle `G` |
| Effet parasitoïdes | — | $0{,}38 \cdot d$, plafond 0,75 | — | `updateLarvalSurvival` |
| Effet TIS | — | $1/(1+0{,}12r)$ | — | `tisF` |
| Fenêtre TIS | — | jours 80 → 260 | DOY | boucle `G` |
| Femelles initiales | $A(0)$ | 30 / 12 / 0,05 | ind./case | init |

## 17. Ce que le modèle ne fait pas

Sans reprise exhaustive (voir [Limites & calibration](07-limites.md)) : pas de mâles ni d'accouplement explicite (seulement $\tau$), pas de structure d'âge, pas de pluie, pas de résistance aux insecticides, pas d'effet sur les auxiliaires, une seule espèce de plante hôte sauvage, grille fermée (aucune immigration extérieure), économie à prix et rendement uniques avec perte totale des fruits piqués.
