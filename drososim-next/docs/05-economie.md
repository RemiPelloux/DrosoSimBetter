---
title: Calcul économique & indicateurs
icon: euro
---

# Calcul économique & indicateurs

```diagram-economie
```

Tous les montants sont **annuels** et portent sur **l'ensemble de l'exploitation dessinée**. Ce sont des **ordres de grandeur indicatifs**, à adapter avec vos propres références dans *Hypothèses économiques* → *Coûts des leviers*.

## 1. Chiffre d'affaires de la récolte saine

Pour chaque parcelle de cerisiers $p$ de surface $S_p$ (ha) :

$$
CA_p = S_p \times Y \times 1000 \times \pi \times \frac{\overline{H}_p}{100}
$$

- $Y$ : rendement potentiel (t/ha, 10 par défaut) ;
- $\pi$ : prix de vente (€/kg, 3,50 par défaut) ;
- $\overline{H}_p$ : récolte saine (%) issue de la simulation, **moyennée sur les années simulées**.

Le CA de la stratégie est la somme sur les parcelles : $CA = \sum_p CA_p$. Un fruit piqué est considéré comme **invendable** (pas de tri ni de déclassement).

## 2. CA sauvé

$$
\text{CA sauvé} = CA_{stratégie} - CA_{témoin}
$$

C'est la valeur de la récolte que la stratégie a protégée par rapport au fait de ne rien faire.

## 3. Coûts des leviers

Pour une parcelle de surface $S$ (ha) sur laquelle le levier est actif, avec $\omega$ le taux horaire de la main-d'œuvre :

| Levier | Intrants / matériel | Main-d'œuvre (heures) |
|---|---|---|
| Filet monorang | $S \times 3\,800$ €/an (amorti) | $40\,S$ h (pose / dépose) |
| Filet monoparcelle | $S \times 2\,600$ €/an (amorti) | $40\,S$ h |
| Prophylaxie | — | $55\,S$ h (ou $90\,S$ h si taux ≥ 95 %) $+ 25\,S$ h si destruction des fruits au sol |
| Traitement conventionnel | $85$ € × passages × $S$ | $1{,}5$ h × passages × $S$ |
| Biocontrôle | $150$ € × passages × $S$ | $1{,}5$ h × passages × $S$ |
| Parasitoïdes | $300$ €/ha (standard) ou $520$ €/ha (renforcé) | — |
| TIS | $950$ €/ha | — |

Toutes les heures sont valorisées au taux $\omega$ (16 €/h par défaut) dans le poste *Main-d'œuvre*. Toutes ces valeurs sont **modifiables** dans l'interface.

Le nombre de passages de traitement facturé est le **nombre maximal configuré**. Avec un déclenchement au seuil, la simulation peut en réaliser moins : le coût affiché est alors un majorant prudent.

## 4. Bilan net et ROI

$$
\text{Bilan net} = \text{CA sauvé} - \text{Coût total}, \qquad
\text{ROI} = \frac{\text{CA sauvé}}{\text{Coût total}}
$$

- **Bilan net > 0** : la stratégie rapporte plus qu'elle ne coûte par rapport au témoin.
- **ROI = 300 %** : chaque euro investi protège 3 € de chiffre d'affaires.

La **meilleure stratégie** mise en avant (bandeau *Verdict*, badge 🏆) est celle qui a le **bilan net le plus élevé** parmi les stratégies affichées.

## 5. IFT chimique

L'**Indice de Fréquence de Traitement** comptabilise les passages conventionnels, pondérés par la surface traitée et ramenés à la surface totale de cerisiers et à l'année :

$$
IFT = \frac{\sum_{\text{passages conv.}} S_{traitée}}{S_{cerisiers} \times N_{ans}}
$$

Le **biocontrôle n'est pas compté** dans l'IFT chimique, conformément à l'usage.

Codes couleur de la jauge : 0 en vert, ≤ 2 en orange, > 2 en rouge.

## 6. Profil multicritère (radar)

Chaque stratégie reçoit un score de 0 à 100 sur six axes. Les normalisations se font **par rapport aux stratégies affichées** : le radar est donc un outil de comparaison relative.

| Axe | Formule |
|---|---|
| Récolte | récolte globale (%) |
| Rentabilité | $50 + 50 \times \dfrac{\text{bilan}}{\max \lvert\text{bilan}\rvert}$ |
| Environnement | $\max(0,\,100 - 20 \times IFT)$ |
| Main-d'œuvre | $100 \times \left(1 - \dfrac{\text{heures}}{\max \text{heures}}\right)$ |
| Pression maîtrisée | $100 \times \left(1 - \dfrac{\text{pic}}{\max \text{pic}}\right)$ |
| Investissement | $100 \times \left(1 - \dfrac{\text{coût}}{\max \text{coût}}\right)$ |

## 7. Seuil de risque

La ligne pointillée rouge des graphiques est un **seuil indicatif de 20 000 femelles/ha**, à l'échelle de ce modèle. Il sert de repère visuel et de critère pour certaines recommandations ; ce n'est pas un seuil réglementaire.

## 8. Recommandations automatiques

Les recommandations de la page de résultats sont générées par des règles explicites :

| Règle | Déclencheur |
|---|---|
| Parcelle prioritaire | la parcelle la plus touchée dans le témoin conserve moins de 85 % de sa récolte |
| Précoces peu exposées | une parcelle précoce conserve plus de 90 % dans le témoin |
| Meilleur bilan | stratégie au bilan le plus élevé |
| Alternative bas IFT | stratégie à l'IFT le plus faible, si différente de la précédente |
| Stratégie déficitaire | bilan net < 0 |
| Pression excessive | pic > 4 × le seuil |
| Réservoir non maîtrisé | récolte de la dernière année inférieure de plus de 10 points à celle de la première |
| Rôle du réservoir | présence d'espaces naturels |
