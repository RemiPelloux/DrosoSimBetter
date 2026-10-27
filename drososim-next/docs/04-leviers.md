---
title: Les leviers de lutte
icon: shield
---

# Les leviers de lutte

Chaque levier agit sur **un maillon précis** du cycle. C'est ce qui rend leurs effets complémentaires… ou redondants.

```diagram-leviers
```

Les leviers sont définis **par parcelle et par stratégie**. Un levier ne s'applique qu'aux types de parcelles compatibles :

| Levier | Cerisiers | Espace naturel |
|---|---|---|
| Prophylaxie | ✅ | — |
| Filet | ✅ | — |
| Traitement | ✅ | — |
| Parasitoïdes | ✅ | ✅ |
| TIS | ✅ | — |

## 1. Filet insect-proof 🛡️

**Réglages** : type *monorang* ($\eta = 0{,}95$) ou *monoparcelle* ($\eta = 0{,}85$) ; pose en *fin de floraison* (jour 105, mi-avril) ou à la *véraison* ($v - 5$).

**Période active** : de la pose jusqu'à $h + 5$ (dépose quelques jours après la récolte).

**Effets dans le modèle** :
1. accès aux fruits réduit : la ponte est multipliée par $(1-\eta)$ ;
2. immigration réduite : 70 % × $\eta$ des femelles qui tentent d'entrer sont refoulées (−67 % en monorang, −60 % en monoparcelle).

**Lecture agronomique** : c'est le levier le plus efficace sur la récolte, surtout pour les variétés tardives, mais il ne réduit **pas** la population du réservoir. Hors période de pose, la parcelle redevient attractive (résidus post-récolte).

## 2. Protection phytosanitaire / biocontrôle 🚜

**Réglages** : mode *conventionnel* (spinosad, cyantraniliprole…) ou *biocontrôle* (argile, huiles) ; 1 à 4 passages ; déclenchement *calendaire* ou *au seuil de piégeage*.

**Fenêtre autorisée** : de $v - 3$ à $h - 3$. Le **délai avant récolte (DAR)** de 3 jours est respecté, avec au moins 7 jours entre deux passages.

**Déclenchement** :
- *calendaire* : le $k$-ième passage a lieu au jour $v + \operatorname{round}\!\left(\frac{(h-3-v)\,k}{n}\right)$, ce qui répartit les passages régulièrement sur la fenêtre ;
- *seuil* : un passage est déclenché dès que la densité moyenne de la parcelle dépasse **1 500 femelles/ha**, dans la limite du nombre de passages.

**Effet** : mortalité additionnelle $\kappa$ sur les adultes de la parcelle, pendant une rémanence $r$ :

| Mode | $\kappa$ (/jour) | Rémanence $r$ | IFT |
|---|---|---|---|
| Conventionnel | 0,32 | 7 j | 1 par passage |
| Biocontrôle | 0,16 | 4 j | 0 (hors IFT chimique) |

En **printemps humide**, la rémanence est multipliée par 0,6 (lessivage).

**Lecture agronomique** : les traitements protègent la récolte de l'année mais agissent peu sur le réservoir. La population revient dès la fin de la rémanence, d'où une efficacité qui se dégrade sur plusieurs années.

## 3. Prophylaxie / hygiène 🧺

**Réglages** : taux de récolte de 80 % (standard) à 99 % (sanitaire : 98 % par défaut) ; destruction des fruits tombés au sol (oui/non).

**Effet** : le jour de la récolte, les fruits laissés sur l'arbre ou au sol deviennent des **résidus** :

$$
R_c = (1 - \text{taux de récolte}) \times \begin{cases} 0{,}25 & \text{si destruction des fruits au sol} \\ 1 & \text{sinon} \end{cases}
$$

Sans prophylaxie, le taux est fixé à 80 % (donc $R = 0{,}2$). Les résidus offrent une ressource de ponte $1{,}4\,R$ et une attractivité $3\,R$ après la récolte.

**Lecture agronomique** : la prophylaxie ne protège pas la récolte de l'année. Elle **casse le rebond post-récolte** (le pic de juillet-août visible sur les courbes) et réduit la population qui hiverne. Son effet est donc **cumulatif sur plusieurs années**.

## 4. Lâchers de parasitoïdes 🐝

*Ganaspis brasiliensis* (*G. kimorum*) ou *Trichopria drosophilae*.

**Réglages** : lâcher au printemps ou à l'automne (affiché sur les courbes) ; dose standard ou renforcée (× 1,4).

**Effet** : réduction de la survie larvaire, avec une **installation progressive** :

$$
\text{installation}(a) = \min(1,\; 0{,}35 + 0{,}33\,a), \qquad
\sigma = 0{,}30 \times \left(1 - \min\!\left(0{,}75,\; 0{,}38 \times \text{installation} \times \text{dose}\right)\right)
$$

où $a$ est le nombre de saisons écoulées depuis le début (0 la première année). La réduction de survie passe ainsi de 13 % la première année à 38 % dès la 3e année (53 % en dose renforcée).

**Lecture agronomique** : c'est un levier « de fond ». Placé dans l'espace naturel, il réduit la production de mouches du réservoir qui alimente tout le verger. Il est quasi invisible la première année, puis significatif en années 2-3.

## 5. Technique de l'insecte stérile (TIS) 🧬

**Réglages** : ratio mâles stériles / sauvages de 2:1 à 20:1 (10:1 par défaut).

**Période** : lâchers hebdomadaires du jour 80 au jour 260 (fin mars → mi-septembre).

**Effet** : seule une fraction des accouplements est fertile :

$$
\tau = \frac{1}{1 + 0{,}12 \times \text{ratio}}
$$

| Ratio | 5:1 | 10:1 | 20:1 |
|---|---|---|---|
| Pontes fertiles $\tau$ | 62 % | 45 % | 29 % |

Dans ce modèle, une ponte non fertile ne produit ni larve **ni dégât** (le facteur $\tau$ multiplie la ponte $E$).

**Lecture agronomique** : la TIS réduit à la fois les dégâts et la croissance de la population, sans résidu. Elle est d'autant plus efficace qu'elle est déployée tôt et sur une surface cohérente.

## 6. Combiner les leviers

Les effets se **multiplient** sur la ponte (filet × TIS) et s'**additionnent** sur la mortalité (traitement). Ils agissent aussi à des moments différents :

| Moment | Leviers efficaces |
|---|---|
| Printemps (installation) | TIS, parasitoïdes (réservoir) |
| Véraison → récolte | Filet, traitements, TIS |
| Post-récolte | Prophylaxie |
| Hiver / long terme | Parasitoïdes, prophylaxie (moins d'hivernants) |

C'est pourquoi une **stratégie intégrée** (filet sur les tardives, prophylaxie partout, parasitoïdes dans le bois) surpasse souvent un levier unique intensif. La différence est d'autant plus marquée que la simulation dure plusieurs années.
