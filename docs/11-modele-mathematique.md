---
title: Spécification du moteur
icon: code
---

# Spécification mathématique du moteur (v2)

Le chapitre [Le modèle biologique](03-modele.md) est une **visite guidée** : il explique *pourquoi* chaque mécanisme existe. Ce chapitre-ci est la **spécification de référence**, destinée à qui veut réimplémenter le moteur, le calibrer ou en discuter les hypothèses : chaque symbole, chaque constante, chaque formule, dans l'ordre exact du calcul.

> **Règle en cas de désaccord** : le code (`src/lib/engine.ts`, constante `MODEL_VERSION = "2.0.0"`) fait foi ; si une formule ci-dessous diverge, c'est la documentation qu'il faut corriger. Tous les nombres de ce chapitre sont calculés à partir du moteur, pas recopiés à la main.

## 0. Forme générale

Le modèle est un **système dynamique déterministe, spatialisé, à temps discret journalier** :

$$
\mathbf{S}_{t+1} = \mathcal{D}_t \circ \mathcal{G}_t^{(\kappa_t)}\big(\mathbf{S}_t\big),
\qquad
\mathbf{S}_t = \big(A_c,\ S_{1,c},\ S_{2,c},\ S_{3,c},\ H_c,\ R_c\big)_{c \in \mathcal{C}}
$$

- $c \in \mathcal{C}$ : cases de la grille, $|\mathcal{C}| = 400$ ;
- $\mathcal{G}$ : opérateur **local** (ressource, capacité, ponte, dégâts, chaîne immature, mortalité), case par case ;
- $\mathcal{D}$ : opérateur de **dispersion** (8 voisines, conservatif, filtré par les filets) ;
- $\kappa_t$ : mortalité additionnelle due à un traitement **actif** ce jour-là, décidée sur $\mathbf{S}_t$ *avant* $\mathcal{G}$ ;
- les leviers $u$ ne sont pas des coefficients de sortie : ils entrent dans $\mathcal{G}$, $\mathcal{D}$ et $\kappa$ ;
- **aucun aléa** : deux appels identiques produisent des sorties identiques au bit près (vérifié par `npm run test:engine`). La variabilité climatique est *quasi-périodique*, pas aléatoire.

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

Voisinage de **Moore** (8 cases), construit **une seule fois au chargement du module** en liste compressée (`NBR_START`, `NBR`) ; les bords sont **réfléchissants** (aucun flux hors grille).

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

$$
a(t) = \left\lfloor \frac{j_0 + t}{365} \right\rfloor,
\qquad
n_{saison}(t) = \max\!\big(0,\; a(t) - [\,j_0 = 273\,]\big)
$$

$n_{saison}$ est le nombre d'années de saison écoulées : il pilote la montée en charge des parasitoïdes.

## 3. Forçage climatique

Toutes les grandeurs de cette section sont **tabulées par profil** sur 365 jours au premier appel (`climateTable(profil)`), puis partagées par toutes les simulations : la boucle journalière ne fait que lire des tableaux.

### 3.1 Température

$$
T(j) = 12{,}5 + 10{,}5\,\sin\!\left(\frac{2\pi\,(j-110)}{365}\right) + \sigma(j) + \Delta_{p}(j)
$$

$$
\sigma(j) = 2{,}0\,\sin\!\left(\frac{2\pi j}{6{,}9} + 0{,}7\right) + 1{,}3\,\sin\!\left(\frac{2\pi j}{17{,}3} + 2{,}1\right)
$$

$\sigma$ est la **variabilité synoptique** : deux oscillations de périodes incommensurables (6,9 et 17,3 jours), d'amplitude totale ±3,3 °C, déterministes. Elle représente les passages de masses d'air et permet aux seuils (gel, 30 °C) d'être franchis.

| Profil $p$ | $\Delta_p$ | $\mu_{hiv}$ | Autre |
|---|---|---|---|
| `mild-winter` — Hiver doux | $+3{,}5$ si $j<60$ ou $j>320$ | 0,016 | — |
| `harsh-winter` — Hiver rigoureux | $-4$ idem | 0,050 | — |
| `humid-spring` — Printemps humide | $-0{,}5$ si $80<j<180$ | 0,028 | ponte $\times 1{,}25$ ; rémanence des traitements $\times 0{,}6$ |
| `dry-summer` — Été caniculaire | $+5$ si $160<j<250$ | 0,028 | — |
| *(référence)* | 0 | 0,028 | sert à définir les seuils phénologiques |

**Plages réellement atteintes** (résumé `climate` renvoyé avec chaque sortie) :

| Profil | $T_{\min}$ | $T_{\max}$ | Jours $T<6$ | Jours $T>30$ | DJ annuels ($>8$ °C) | DJ 1er mars → 19 juil. | Générations théoriques sur cette période |
|---|---|---|---|---|---|---|---|
| référence | −1,2 | 25,9 | 100 | 0 | 2 173 | 1 072 | 5,1 |
| hiver doux | 1,4 | 25,9 | 51 | 0 | 2 226 | 1 072 | 5,1 |
| hiver rigoureux | −5,2 | 25,9 | 117 | 0 | 2 170 | 1 072 | 5,1 |
| printemps humide | −1,2 | 25,9 | 101 | 0 | 2 127 | 1 026 | 4,9 |
| été caniculaire | −1,2 | **30,9** | 100 | **5** | 2 618 | 1 272 | 6,1 |

Repères de la courbe de référence : 5,0 °C le 1er janvier, 1,4 °C le 1er mars, 10,3 °C le 1er avril, 19,8 °C le 1er juin, 22,8 °C le 1er juillet, 15,0 °C le 1er octobre. Premier jour $T > 10$ °C : $j = 83$ (24 mars) ; 213 jours $T>10$, 86 jours $T>20$.

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
\delta(T) = \min\!\left(1,\ \frac{\max(0,\;T-8)}{210}\right),
\qquad
\delta_{stade} = \min(1,\ 3\,\delta)
$$

$\delta_{stade}$ est la fraction d'un **sous-stade** qui passe au suivant chaque jour (§ 6.3). 210 degrés-jours au-dessus de 8 °C ≈ **15 jours** œuf → adulte à 22 °C.

### 3.4 Réponses au froid et à la chaleur (tabulées)

$$
f_{froid}(T) = \begin{cases} \min\!\left(1{,}5,\ \dfrac{6 - T}{4}\right) & T < 6\\[6pt] 0 & \text{sinon}\end{cases}
\qquad
\mu_{chaleur}(T) = \begin{cases} \min\!\big(0{,}06,\ 0{,}012\,(T - 28)\big) & T > 28\\ 0 & \text{sinon}\end{cases}
$$

### 3.5 Autres tables

$$
\rho_{nat}(j) = \begin{cases} 0{,}05 & j < 95\\ 0{,}12 + 0{,}28\,\max\!\left(0,\ \sin\dfrac{\pi\,(j-95)}{270}\right) & j \ge 95\end{cases}
\qquad
D(T) = \begin{cases} 0{,}12 & T > 10\\ 0{,}03 & \text{sinon}\end{cases}
\qquad
\mu_L(T) = \begin{cases} 0{,}03 & T < 5\\ 0{,}012 & \text{sinon}\end{cases}
$$

et le cumul $\mathrm{DJ}(j) = \sum_{i \le j} \max(0, T(i) - 8)$ qui sert à la phénologie.

## 4. Phénologie thermique

Dates **de référence** (climat de référence) et durées de maturation :

| Type | Code | $v_{ref}$ | $h_{ref}$ | $h - v$ |
|---|---|---|---|---|
| Cerise précoce | `early-cherry` | 130 | 158 | 28 j |
| Cerise de saison | `season-cherry` | 150 | 178 | 28 j |
| Cerise tardive | `late-cherry` | 168 | 200 | 32 j |

Pour un profil $p$, la véraison est le **premier jour où le cumul de degrés-jours atteint celui de la date de référence** dans le climat de référence, et la récolte suit à durée fixe :

$$
v_p = \min\{\, j \in [60, 300) : \mathrm{DJ}_p(j) \ge \mathrm{DJ}_{ref}(v_{ref}) \,\},
\qquad
h_p = v_p + (h_{ref} - v_{ref})
$$

Résultat par profil (véraison / récolte) :

| Profil | Précoce | Saison | Tardive |
|---|---|---|---|
| référence, hiver rigoureux | 130 / 158 | 150 / 178 | 168 / 200 |
| hiver doux | 129 / 157 | 150 / 178 | 168 / 200 |
| printemps humide | 133 / 161 | 153 / 181 | 172 / 204 |
| été caniculaire | 130 / 158 | 150 / 178 | 166 / 198 |

Ces dates sont utilisées **partout** (ressource, attractivité, DAR des traitements, pose des filets, date de récolte) et renvoyées dans `SimOutput.phenology`. La constante `PHENOLOGY` du code ne contient que les dates de référence et les libellés.

## 5. Ressource $\rho$, capacité $K$, attractivité $w$

| Case | Phase | $\rho_c$ | $\hat\rho_c$ | $w_c$ |
|---|---|---|---|---|
| Zone neutre | toujours | 0,003 | — ($K = 8$) | 0,15 |
| Espace naturel | toujours | $\rho_{nat}(j)$ | $\rho_{nat}/0{,}4$ | $0{,}6 + \rho_{nat}(j)$ |
| Cerisier | $j < v-5$ | 0,02 | 0,02 | 0,25 |
| Cerisier | $v-5 \le j < v$ | 0,02 | 0,02 | **3** |
| Cerisier | $v \le j < h$ | **1** | 1 | **3** |
| Cerisier | $j \ge h$ | $1{,}4\,R_c + 0{,}02$ | idem | $0{,}3 + 3\,R_c$ |

Capacité d'accueil du jour (limite la ponte) et capacité statique (seuil du surpeuplement) :

$$
K_c = K_{type}\,\max(0{,}25,\ \hat\rho_c),
\qquad
K_{type} = \begin{cases} 260 & \text{espace naturel}\\ 700 & \text{cerisier}\\ 8 & \text{neutre}\end{cases}
$$

Exemples : espace naturel en mars $K = 65$ ; cerisier avant véraison $K = 175$ ; en fenêtre $K = 700$ ; après récolte avec 20 % de résidus $K = 210$ ; avec 2 % de résidus $K = 175$ (plancher).

**Résidus post-récolte.** Le jour $j = h$ (inclus dans la phase « à partir de la récolte » : il n'y a plus de trou d'un jour) :

$$
R_c \leftarrow (1 - r_h) \times \begin{cases} 0{,}25 & \text{prophylaxie et destruction au sol}\\ 1 & \text{sinon}\end{cases},
\qquad
r_h = \begin{cases} \texttt{harvestRate}/100 & \text{prophylaxie}\\ 0{,}80 & \text{sinon}\end{cases}
$$

puis, chaque jour suivant, $R_c \leftarrow 0{,}965\,R_c$ (demi-vie ≈ 19,5 jours).

## 6. Opérateur local $\mathcal{G}$

Pour chaque case $c$, dans cet ordre exact (extrait fidèle du code) :

```ts
// pic de densité (état après la dispersion de la veille)
// ressource ρ, capacité K (dynamique) et Ks (statique), attractivité w, filet η  → § 5
const dd   = a < K ? 1 - a / K : 0;
const eggs = a * 8 * suit * res * (1 - net) * (tisOn ? tisF : 1) * dd * humidF;
if (fruit && eggs > 0) healthy *= Math.exp(-eggs / 3500);

const o1 = s1 * devStage, o2 = s2 * devStage, o3 = s3 * devStage;   // sorties de sous-stade
S1 = (s1 - o1) * (1 - muL) + eggs * 0.30;
S2 = (s2 - o2) * (1 - muL) + o1;
S3 = (s3 - o3) * (1 - muL) + o2 * paraF;                           // parasitoïdes à la sortie de S2
const emerge = o3;

let mort = 0.028 + heat;
if (coldF > 0)  mort += coldF * muHiv * (forest ? 0.5 : 1);
if (neutral)    mort += 0.04;
if (a > Ks)     mort += 0.15 * (a / Ks - 1);
if (treatRemain[parcel] > 0) mort += treatKill[parcel];
if (mort > 0.95) mort = 0.95;
a = a * (1 - mort) + emerge;
```

### 6.1 Ponte

$$
E_c = A_c \cdot 8 \cdot \varphi(T) \cdot \rho_c \cdot (1-\eta_c) \cdot \tau_c \cdot \left(1 - \frac{A_c}{K_c}\right)^{\!+} \cdot h_{hum}
$$

| Terme | Sens | Valeur |
|---|---|---|
| $8$ | fécondité maximale | 8 œufs ♀⁻¹ j⁻¹ |
| $\eta_c$ | efficacité du filet actif | 0 ; 0,95 (monorang) ; 0,85 (monoparcelle) |
| $\tau_c$ | fertilité des pontes (TIS) | $1$, ou $1/(1+0{,}12\,r)$ dans la fenêtre TIS |
| $h_{hum}$ | printemps humide | 1,25 ou 1 |
| $(\cdot)^+$ | compétition pour la ressource du jour | plafonne la ponte à $A = K_c$ |

### 6.2 Dégâts sur fruits

Pendant la fenêtre $[v, h)$ seulement :

$$
H_c \leftarrow H_c \cdot \exp\!\left(-\frac{E_c}{3\,500}\right)
\;\Longrightarrow\;
H_c(T) = \exp\!\left(-\frac{1}{3\,500}\sum_{t} E_c(t)\right)
$$

Loi de Poisson : 2 426 œufs cumulés dans une case (≈ 24 œufs/m²) font tomber la fraction saine à 50 %. À $A = K = 700$, $E$ est nulle par densité-dépendance ; le maximum de $E$ sur une case est atteint à $A = K/2 = 350$ et vaut $350 \times 8 \times \tfrac12 = 1\,400$ œufs/jour (à $\varphi = \rho = 1$), soit $H \times 0{,}67$ par jour : **une case en fenêtre de sensibilité est perdue en moins d'une semaine** de forte pression.

### 6.3 Chaîne immature (délai gamma)

$$
\begin{aligned}
S_1 &\leftarrow (1 - \delta_s)(1 - \mu_L)\,S_1 + 0{,}30\,E_c\\
S_2 &\leftarrow (1 - \delta_s)(1 - \mu_L)\,S_2 + \delta_s S_1\\
S_3 &\leftarrow (1 - \delta_s)(1 - \mu_L)\,S_3 + \delta_s S_2\,(1 - \pi_c)\\
\text{Ém} &= \delta_s S_3
\end{aligned}
\qquad \delta_s = \min(1, 3\delta)
$$

Trois compartiments à taux $3\delta$ réalisent un **délai de loi gamma d'ordre 3** de moyenne $1/\delta$ et de coefficient de variation $1/\sqrt{3} \approx 0{,}58$ : la majorité des individus émerge entre 0,5 et 1,5 fois la durée moyenne, aucun le jour même. $\pi_c$ est la fraction parasitée (§ 9).

### 6.4 Adultes

$$
A_c \leftarrow A_c\,(1-\mu_c) + \text{Ém}
$$

$$
\mu_c = 0{,}028 + \mu_{chaleur}(T) + \mu_{hiv}\,f_{froid}(T)\,\big(0{,}5\,[\text{esp. naturel}]\big) + 0{,}04\,[\text{neutre}] + 0{,}15\left(\frac{A_c}{K_{type}} - 1\right)^{\!+} + \kappa_p\,[\text{traitement actif}]
$$

plafonnée à 0,95. Espérance de vie de base : $1/0{,}028 \approx 36$ jours.

**Taux d'accroissement intrinsèque** (équation d'Euler-Lotka appliquée à la chaîne, à 22 °C, $\varphi = \rho = 1$, sans densité-dépendance) : $r \approx 0{,}216$ j⁻¹, soit un temps de doublement de **3,2 jours**. C'est l'ordre de grandeur des mesures de laboratoire sur *D. suzukii* (0,15 – 0,22 j⁻¹ entre 22 et 28 °C).

**Survie hivernale résultante** (1er octobre → 1er mars, sans reproduction) :

| Profil | Surmortalité froid seule, plein champ | idem, espace naturel | Survie totale, plein champ | Survie totale, espace naturel |
|---|---|---|---|---|
| Hiver doux | 83 % | 91 % | 1,2 % | 1,3 % |
| Référence / humide / caniculaire | 15 % | 39 % | 0,22 % | 0,57 % |
| Hiver rigoureux | 0,1 % | 3,4 % | < 0,01 % | 0,05 % |

La colonne « survie totale » inclut les 0,028 /j de base sur 151 jours ($e^{-4{,}2} \approx 1{,}5\,\%$) : même un hiver doux divise la population par ≈ 80.

## 7. Dispersion $\mathcal{D}$

Pour chaque case source $c$, avec $V(c)$ le voisinage de Moore, $w$ l'attractivité et $\eta$ le filet actif :

$$
\text{sortants}_c = D\,A_c\,(1 - 0{,}7\,\eta_c)
\qquad
\Phi_n = \text{sortants}_c \cdot \frac{w_n}{\sum_{m \in V(c)} w_m}
$$

$$
\text{reçu}_n = \Phi_n\,(1 - 0{,}7\,\eta_n),
\qquad
\text{refoulé}_c = \sum_{n} \Phi_n \cdot 0{,}7\,\eta_n
$$

$$
A_n \leftarrow A_n + \text{reçu}_n,
\qquad
A_c \leftarrow A_c - \text{sortants}_c + \text{refoulé}_c
$$

Propriétés :

- **conservatif** : aucun individu n'est créé ni perdu par la dispersion ; les refoulées restent chez elles (bords réfléchissants inclus) ;
- le filet est **symétrique** (v2) : il freine l'entrée et la sortie dans la même proportion $0{,}7\,\eta$ ;
- si $\sum_m w_m = 0$ ou si les sortants sont $< 10^{-4}$, la case ne disperse pas ;
- le flux est **orienté par l'attractivité**, donc pas une diffusion isotrope.

Ordre de grandeur (marche aléatoire non biaisée équivalente, case de 10 m) : écart-type du déplacement $\approx 4{,}2\sqrt{t}$ m, ≈ 23 m en 30 jours ; en pratique les flux se concentrent vers les cases attractives.

## 8. Traitements ($\kappa$)

Un traitement n'est déclenché que si le levier est actif sur une parcelle de cerisier, et si **toutes** ces conditions sont réunies :

```
véraison − 3  ≤  j  ≤  récolte − 3          (délai avant récolte)
nb_passages(année)  <  treatmentPasses
t − dernier_passage  ≥  7 jours
déclencheur satisfait
```

Déclencheur `calendar` — passages répartis uniformément sur la fenêtre :

$$
\text{slot}_k = v + \left\lfloor \frac{(h - 3 - v)\;k}{n} \right\rceil,
\qquad k = 0, \dots, n-1
$$

Déclencheur `threshold` — densité moyenne de la parcelle :

$$
\frac{1}{|P|}\sum_{c \in P} A_c \cdot \frac{10^4}{S_c} > 1\,500\ \text{femelles/ha}
$$

Effet d'un passage :

$$
\kappa_p = \begin{cases} 0{,}32 & \text{conventionnel}\\ 0{,}16 & \text{biocontrôle}\end{cases}
\qquad
\text{rémanence} = \begin{cases} 7\ \text{j} & \text{conv.}\\ 4\ \text{j} & \text{bio}\end{cases} \times \begin{cases} 0{,}6 & \text{printemps humide}\\ 1 & \text{sinon}\end{cases}
$$

Le traitement ne touche que les **adultes** et s'applique à toutes les cases de la parcelle.

**IFT et coûts sur les passages réels (v2).** Les compteurs `passesConv` et `passesBio` par parcelle enregistrent les passages déclenchés :

$$
\text{IFT} = \frac{1}{N_{ans}} \cdot \frac{\sum_{\text{passages conv.}} |P|}{|P_{\text{cerisiers}}|},
\qquad
C_{\text{phyto}} = \sum_P S_P \left(\frac{n_{conv,P}}{N_{ans}}\,85 + \frac{n_{bio,P}}{N_{ans}}\,150\right)
$$

Un déclenchement au seuil qui ne traite pas coûte 0 € et compte 0 dans l'IFT. Le total `treatmentsApplied` est renvoyé avec chaque résultat.

## 9. Les cinq leviers dans les équations

| Levier | Paramètre | Entre dans | Effet exact |
|---|---|---|---|
| **Filet** | `netType` ∈ {monorang, monoparcelle} | $\eta_c$ | 0,95 / 0,85 |
| | `netDeploy` ∈ {bloom, veraison} | période | actif de $j=105$ (floraison) ou $v-5$, jusqu'à $h+5$ |
| | — | $\mathcal{D}$ | freine entrée **et** sortie de $0{,}7\,\eta$ |
| **Prophylaxie** | `harvestRate` (80→98) | $r_h$ | fruits non cueillis 20 % → 2 % |
| | `groundFruitDestruction` | $R_c$ | résidus ×0,25 |
| **Traitement** | `treatmentMode`, `passes`, `trigger` | $\kappa_p$ | cf. §8 |
| **Parasitoïdes** | `parasitoidDose` ∈ {standard, reinforced} | $\pi_c$ | voir ci-dessous |
| | `parasitoidSeason` ∈ {spring, autumn} | événement | lâcher $j=100$ ou $j=280$ (marqueur) |
| **TIS** | `tisRatio` $r \in [5, 20]$ | $\tau_c$ | $\tau = 1/(1+0{,}12\,r)$, actif $80 \le j \le 260$ |

Fraction parasitée, appliquée à la sortie du stade larvaire :

$$
\pi_c = \min\big(0{,}75,\ 0{,}38 \cdot \min(1,\ 0{,}35 + 0{,}33\,n_{saison}) \cdot d\big),
\qquad d = \begin{cases}1 & \text{standard}\\ 1{,}4 & \text{renforcé}\end{cases}
$$

L'effet est **cumulatif dans le temps** et **plafonné à 75 %**. TIS : $\tau = 0{,}625$ à $r=5$, $0{,}455$ à $r=10$, $0{,}294$ à $r=20$ — uniquement entre les jours 80 et 260.

## 10. Conditions initiales

$$
A_c(0) = \begin{cases}
50 & \text{espace naturel, départ automne}\\
20 & \text{espace naturel, départ printemps}\\
1 & \text{cerisier}\\
0 & \text{zone neutre}
\end{cases}
\qquad
S_{1,2,3} = 0,\quad H_c = 1,\quad R_c = 0
$$

$H$ est réinitialisé à 1 et les compteurs annuels de passages à 0 à chaque 1er janvier.

## 11. Sorties

| Sortie | Définition | Notes |
|---|---|---|
| Séries | tous les 3 jours : $A_c \cdot 10^4/S_c$ moyenné par parcelle, plus `forest_all` et `cherry_all` | 1 point = 1 label « 12 juin A2 » |
| Fruits sains | $100 \times \overline{H}_P$ le jour $j = h$ de chaque parcelle | moyenne sur les années + détail `harvestByParcelYear` |
| Récolte globale | moyenne des parcelles de cerisier pondérée par le nombre de cases | 100 si aucun cerisier |
| Pic | $\max_{t,c \in \text{cerisiers}} A_c(t)\cdot 10^4/S_c$ | femelles/ha |
| Carte de pression | $P_c = \max_t A_c(t)\cdot 10^4/S_c$ | `peakByCell`, une valeur par case |
| Événements | traitements, filets, récoltes, lâchers, TIS | datés en jours absolus |
| IFT, `treatmentsApplied` | cf. §8 | passages réels |
| Coûts, CA, heures | cf. §12 | annuels |
| `phenology` | fenêtres $[v_p, h_p)$ du profil | dessinées sur les courbes |
| `climate` | $T_{\min}$, $T_{\max}$, DJ, jours froids / chauds | résumé du profil |
| `modelVersion` | `"2.0.0"` | utile aux backends tiers |

## 12. Économie

Coûts **annuels**, calculés sur les leviers déclarés sauf les traitements (passages réels, §8) :

$$
C_{\text{filet}} = S_P \, c_{\text{filet}} \qquad
C_{\text{bio}} = S_P \, c_{\text{parasitoïde}} \qquad
C_{\text{TIS}} = S_P \, c_{\text{TIS}}
$$

avec, en €/ha/an : $c_{\text{filet}} = 3\,800$ (monorang) ou $2\,600$ (monoparcelle) ; $c_{\text{parasitoïde}} = 300$ (standard) ou $520$ (renforcé) ; $c_{\text{TIS}} = 950$. $S_P$ est la surface de la parcelle en hectares.

Travail (16 €/h) : filet 40 h/ha ; prophylaxie 90 h/ha si `harvestRate` ≥ 95 sinon 55, + 25 h/ha de destruction au sol ; traitement 1,5 h par passage réel et par ha.

Chiffre d'affaires annuel, sommé sur les parcelles de cerisier :

$$
\text{CA} = \sum_{P} S_P \cdot Y \cdot 1000 \cdot p \cdot \frac{\overline{H}_P}{100}
$$

avec $Y = 10$ t/ha et $p = 3{,}5$ €/kg. Indicateurs dérivés, calculés dans l'interface :

$$
\text{CA sauvé} = \text{CA}(\text{stratégie}) - \text{CA}(\text{témoin}),
\qquad
\text{Bilan net} = \text{CA sauvé} - C_{\text{total}},
\qquad
\text{ROI} = \frac{\text{CA sauvé}}{C_{\text{total}}}
$$

Chaque poste de coût est arrondi à l'euro ; `totalCost` est la somme des postes arrondis.

## 13. Implémentation numérique

| Choix | Raison |
|---|---|
| Tables climatiques par profil (`Float64Array[365]`), mises en cache | la boucle ne calcule ni sinus ni exponentielle climatique ; toutes les stratégies et toutes les simulations d'un même profil les partagent |
| Voisinage de Moore construit au chargement du module | zéro reconstruction par simulation |
| Parcelles aplaties (`pStart`, `pCells`, `pIsCherry`, `pVer`, `pHar`) | aucune fermeture ni `forEach` dans la boucle journalière |
| Sous-stades entrelacés (`S[3c], S[3c+1], S[3c+2]`) | localité mémoire |
| Une seule passe locale par jour (ressource, capacité, attractivité, filet, ponte, chaîne, mortalité, pic) | moins de parcours de la grille |
| `nextA` puis `A.set(nextA)` | dispersion de type Jacobi |
| Cases neutres vides court-circuitées | la majorité des cases d'un verger réel |
| Aucun `Math.random` | déterminisme total |
| Parcelles détectées par composantes 4-connexes, mémoïsées par `WeakMap` | une seule détection par édition de la grille |
| Web Worker (`sim.worker.ts`) | interface fluide pendant le recalcul |

Complexité : $\mathcal{O}(T_{tot} \cdot |\mathcal{C}|)$ en temps, $\mathcal{O}(|\mathcal{C}|)$ en mémoire d'état. Mesure de référence (`npm run test:engine`) : 4 stratégies × 3 ans en **60 – 90 ms** sur un portable, soit ≈ 20 ms par stratégie et par 3 ans, malgré trois fois plus de compartiments immatures que la v1.

## 14. Comportements émergents

Ces régularités **sortent** des équations ; elles servent de test de non-régression (`npm run test:engine`, 25 vérifications). Verger de démonstration, départ printemps, 3 ans, hiver doux :

| Comportement attendu | Observé (récolte saine A1 / A2 / A3) |
|---|---|
| Les précoces échappent au pic estival | témoin : précoce 97 / 78 / 78 %, tardive 51 / 6 / 9 % |
| La pression s'installe sans protection | saison 82 → 34 % entre A1 et A2 |
| Un hiver rigoureux réduit la pression | tardive 56 / 34 / 38 % (contre 51 / 6 / 9) |
| Un printemps humide l'aggrave | tardive 31 / 8 / 10 % |
| Un été caniculaire freine la ponte | tardive 48 / 18 / 20 % |
| Les traitements seuls s'épuisent | 2 passages conv. : tardive 82 / 31 / 36 % |
| Prophylaxie et parasitoïdes agissent à retardement | parasitoïdes : gain sur la tardive +10 pt en A1, +31 pt en A3 |
| Le filet domine sur la récolte saine | 100 % partout (99,9 % en global : quelques résidentes sous le filet) |
| La TIS à 20:1 approche le filet, sans IFT | tardive 98 / 95 / 91 % |
| Sans refuge, l'infestation démarre très bas | population initiale ÷ 10 |

## 15. Protocole de calibration

Tous les paramètres sont dans l'objet exporté `PARAMS` ; après modification d'un paramètre climatique, appeler `resetClimateCache()`. Ordre de priorité, du plus rentable au plus fin :

1. **Météo réelle** — remplacer `temperature(j, profil)` par une série journalière (le reste du moteur ne lit que la table). La variabilité synoptique synthétique devient alors inutile.
2. **Phénologie locale** — remplacer les trois seuils de degrés-jours (`REF_DD`) et durées de maturation (`RIPENING_DAYS`) par des valeurs observées.
3. **Dynamique** — ajuster `fecundity`, `adultMort`, `eggSurvival`, `dispersalWarm`, les capacités `K` et `crowdMort` sur des **courbes de piégeage** ; vérifier d'abord la position du pic et la profondeur du creux printanier.
4. **Dégâts** — ajuster `damageConst` pour que $\overline{H}$ rejoigne les taux de fruits piqués observés.
5. **Leviers** — $\eta$ (filets), $\kappa$ et rémanence, montée en charge des parasitoïdes, $\tau$ (TIS), à partir d'essais publiés.
6. **Validation** — garder une année ou un site hors calibration, puis comparer.

Après chaque modification : `npm run test:engine` puis comparaison des exports CSV.

## 16. Annexe — table maître des paramètres (`PARAMS`)

| Clé | Symbole | Valeur | Unité | Rôle |
|---|---|---|---|---|
| `fecundity` | — | 8 | œufs ♀⁻¹ j⁻¹ | ponte maximale |
| `eggSurvival` | — | 0,30 | — | fraction d'œufs entrant dans $S_1$ |
| `stages` | — | 3 | — | ordre du délai gamma |
| `ddTotal`, `ddBase` | — | 210, 8 | DJ, °C | développement |
| `immatureMort`, `immatureMortCold` | $\mu_L$ | 0,012 / 0,03 | j⁻¹ | immatures (seuil 5 °C) |
| `adultMort` | $\mu$ | 0,028 | j⁻¹ | adultes |
| `neutralMort` | — | 0,04 | j⁻¹ | zone neutre |
| `crowdMort` | — | 0,15 | j⁻¹ par unité de $(A/K_{type}-1)^+$ | surpeuplement |
| `heatT0`, `heatMortPerDeg`, `heatMortMax` | $\mu_{chaleur}$ | 28, 0,012, 0,06 | °C, j⁻¹ °C⁻¹, j⁻¹ | chaleur |
| `coldT0`, `coldRamp`, `coldMax` | $f_{froid}$ | 6, 4, 1,5 | °C, °C, — | froid |
| `winterExtra` | $\mu_{hiv}$ | 0,016 / 0,050 / 0,028 / 0,028 | j⁻¹ | doux / rigoureux / humide / caniculaire |
| `forestShelter` | — | 0,5 | — | abri de l'espace naturel |
| `K` | $K_{type}$ | 260 / 700 / 8 | ind./case | espace naturel / cerisier / neutre |
| `kFloor` | — | 0,25 | — | plancher de $K_c/K_{type}$ |
| `wildMax` | — | 0,40 | — | normalisation de $\rho_{nat}$ |
| `damageConst` | — | 3 500 | œufs/case | dégâts |
| `residualDecay` | — | 0,965 | j⁻¹ | résidus |
| `dispersalWarm`, `dispersalCold` | $D$ | 0,12 / 0,03 | j⁻¹ | seuil 10 °C |
| `netBlock` | — | 0,7 | — | part refoulée par un filet |
| `threshold` | — | 1 500 | femelles/ha | déclenchement au seuil |
| `tisWindow` | — | [80, 260] | DOY | fenêtre TIS |
| `initForestSpring`, `initForestAutumn`, `initCherry` | $A(0)$ | 20 / 50 / 1 | ind./case | conditions initiales |

Constantes hors `PARAMS` (dans le code) : efficacités de filet 0,95 / 0,85 ; dates de pose 105 ou $v-5$, dépose $h+5$ ; $\kappa$ 0,32 / 0,16 ; rémanence 7 / 4 j ; DAR 3 j ; intervalle 7 j ; parasitoïdes 0,38, 0,35 + 0,33 par saison, plafond 0,75, dose 1,4 ; TIS 0,12 ; synoptique 2,0 / 6,9 / 0,7 et 1,3 / 17,3 / 2,1 ; sinusoïde 12,5 / 10,5 / 110.

## 17. Ce que le modèle ne fait pas

Pas de mâles ni d'accouplement explicite (seulement $\tau$), pas de pluie ni d'humidité explicite, pas de résistance aux insecticides, pas d'effet sur les auxiliaires, une seule espèce de plante hôte sauvage, grille fermée (aucune immigration extérieure), économie à prix et rendement uniques avec perte totale des fruits piqués, traitement sans effet sur les immatures. Voir [Limites & calibration](07-limites.md).
