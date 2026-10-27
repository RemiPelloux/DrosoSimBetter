---
title: Guide d'utilisation
icon: compass
---

# Guide d'utilisation

## 1. Page d'accueil

- **Commencer la simulation** ouvre l'éditeur (ou reprend le dernier projet, sauvegardé automatiquement dans le navigateur).
- **Voir une démo** charge un verger type (bois au nord, Burlat, Summit, Regina) avec trois stratégies pré-remplies (*Conventionnelle*, *Protection intégrée*, *TIS + biocontrôle*), puis ouvre directement les résultats.

À la première visite de l'éditeur, une **visite guidée en 4 étapes** présente l'outil. Si la grille est vide à la fin, le modèle *Verger mixte* est chargé.

## 2. Dessiner le verger

### Types de cases

| Type | Couleur | Rôle dans le modèle |
|---|---|---|
| Espace naturel | vert forêt hachuré | Réservoir : ressource sauvage étalée d'avril à décembre, refuge hivernal |
| Cerise précoce | orange ambré | Sensible du 10 mai au 7 juin (véraison → récolte) |
| Cerise de saison | rouge corail | Sensible du 30 mai au 27 juin |
| Cerise tardive | rouge bordeaux | Sensible du 17 juin au 19 juillet, en plein pic de population |
| Zone neutre | gris clair | Ni ressource ni refuge : mortalité accrue, transit faible |

### Outils

| Outil | Touche | Usage |
|---|---|---|
| Pinceau | `B` | Cliquer-glisser. Taille 1×1, 2×2 ou 3×3 (`[` / `]`). Le trait est interpolé : un geste rapide ne laisse aucun trou |
| Zone | `R` | Tracer un rectangle plein. Ses dimensions et sa surface s'affichent en direct |
| Remplir | `F` | Remplit la zone contiguë de même type |
| Gomme | `E` | Efface. **Le clic droit gomme quel que soit l'outil actif** |
| Éditer | `V` | Un clic sur une case ouvre le menu d'édition |
| Types | `1` à `4` | Espace naturel, Précoce, Saison, Tardive |

Avec le pinceau 1×1, un **clic simple sur une case déjà de la même couleur** ouvre aussi le menu d'édition. Ce menu permet de :
- changer **la case** ou **toute la parcelle** de type ;
- **scinder** la parcelle horizontalement ou verticalement (une ligne de cases est effacée, ce qui crée deux parcelles) ;
- effacer la case ou supprimer la parcelle.

### Parcelles

Les cases de même type qui se touchent par un côté forment automatiquement une **parcelle** (`Cerise Tardive-1`…), entourée d'un liseré. La liste sous la grille affiche la surface de chaque parcelle et permet de la **renommer** (« Haut – Regina »). Les noms sont conservés quand le dessin change.

La **barre d'état** affiche la coordonnée de la case survolée (ex. `C12`), sa parcelle, sa surface, ainsi que la surface totale dessinée.

### Mise en page

- **Agrandir** (ou `Maj+F`) : éditeur plein écran, avec à droite l'impact en direct et les leviers. `Échap` pour revenir.
- **Poignées** entre les colonnes : glisser pour redimensionner, double-clic pour réinitialiser. Préréglages *Éditeur large*, *Équilibrée*, *Leviers large*.
- **Modèles** : *Verger mixte*, *Verger enclavé* (haies sur 4 côtés), *Plaine arboricole* (sans refuge), *Page blanche*.

## 3. Paramétrer la simulation

- **Début** : printemps (1er mars) ou automne (1er octobre). Un départ à l'automne ajoute l'hiver, pour que la simulation couvre bien *N* saisons de récolte.
- **Durée** : 1, 2 ou 3 ans. Les parasitoïdes ne donnent leur plein effet qu'en années 2-3.
- **Profil climatique** : hiver doux, hiver rigoureux, printemps humide, été caniculaire (détails dans *Le modèle biologique*).
- **Hypothèses économiques** : rendement (t/ha), prix (€/kg), surface d'une case (m²) et **coûts unitaires des leviers**, tous modifiables.

## 4. Stratégies et leviers

- La stratégie **Témoin** est permanente et non modifiable : c'est la référence de comparaison.
- **Ajouter**, **Dupliquer**, **Renommer**, **Supprimer** des stratégies, chacune avec sa couleur.
- Pour chaque parcelle, cinq boutons activent les leviers. Ceux qui ne s'appliquent pas au type de parcelle sont grisés (par exemple, seuls les parasitoïdes sont possibles en espace naturel).
- Déplier une parcelle donne accès aux **réglages avancés** de chaque levier actif.
- **Appliquer à toutes les parcelles** active ou désactive un levier sur l'ensemble des vergers en un clic.

L'**aperçu temps réel** (colonne de droite) recalcule la stratégie active et le témoin à chaque modification.

## 5. Lire les résultats

Ce sont les éléments de la page `/résultats` :

1. **Verdict** : la stratégie au meilleur bilan net, résumée en une phrase et trois chiffres.
2. **Cartes KPI côte à côte** : récolte préservée (écart en points vs témoin), bilan net, pic de femelles/ha (écart en % vs témoin), IFT (jauge) et heures de main-d'œuvre. Cliquer une carte la sélectionne pour les graphiques détaillés.
3. **Récolte par parcelle** : barres avec valeur exacte en %, le témoin étant hachuré.
4. **Récolte année par année** : montre si le réservoir est maîtrisé (stable) ou non (déclin).
5. **Dynamique des populations** : courbes par parcelle, bandes de sensibilité, marqueurs 🚜 traitement, 🛡️ filet, 🧺 récolte, 🐝 parasitoïdes, 🧬 TIS. Légende cliquable, infobulle avec densités et % de fruits sains. Mode **Superposition** : pression moyenne sur cerisiers, toutes stratégies confondues.
6. **Bilan économique** : CA sauvé (vert) face aux coûts par poste, avec la ligne du bilan net.
7. **Profil multicritère** (radar 0-100).
8. **Évolution des fruits sains** pendant les fenêtres de sensibilité.
9. **Carte de pression maximale** : pic de femelles/ha par case, sur une échelle commune au témoin.
10. **Matrice des leviers**, **détail des coûts**, **recommandations générées** et **hypothèses du modèle**.

Des **réglages rapides** (climat, durée, économie) sont disponibles directement sur cette page.

## 6. Sauvegarde, partage, export

**Tous les formats exportés contiennent le projet complet** (grille, noms des parcelles, stratégies, leviers, paramètres, hypothèses économiques) et **se rechargent** via *Importer* ou par glisser-déposer.

| Format (menu *Exporter*) | Usage | Rechargeable |
|---|---|---|
| **Projet JSON** (`.json`, aussi `Ctrl+S`) | format complet et lisible | ✅ |
| **Fichier DrosoSim** (`.drososim`) | format compact compressé (environ 3× plus léger) | ✅ |
| **Image du verger** (`.png`) | plan du verger à envoyer ou imprimer ; le projet est caché dans l'image (bloc `tEXt`) | ✅ |
| **Tableur CSV** (`.csv`) | grille 20×20 en lettres (F/P/S/T/.) et leviers, ouvrable dans Excel | ✅ |
| **Lien de partage** (`.txt`) | lien `…?sim=…` à envoyer par e-mail ou messagerie | ✅ |
| **Séries CSV** (page résultats) | séries temporelles et synthèse, projet inclus en dernière ligne | ✅ |
| **Fiche Conseil PDF** | rapport A4 imprimable | ❌ (document de restitution) |

**Importer** accepte, en détectant le format automatiquement :
- tous les fichiers ci-dessus ;
- un **lien de partage** ou un texte collé (*Importer → Coller un lien ou un texte*) ;
- une **grille saisie à la main** dans un tableur : 20 lignes × 20 colonnes, séparateur `;`, `,`, tabulation ou espace. Les codes `F/P/S/T/.` ou les mots `forêt`, `précoce`, `saison`, `tardive`, `vide` sont acceptés, en français ou en anglais. Les stratégies existantes sont conservées.

Les fichiers Excel natifs (`.xlsx`) ne sont pas lus directement : il faut d'abord les enregistrer en CSV.

**Glisser-déposer** : déposez un fichier n'importe où dans l'application pour l'importer.

Autres actions :

| Action | Effet |
|---|---|
| Sauvegarde automatique | le projet est conservé dans le navigateur (localStorage) |
| **Partager** | copie le lien `…?sim=…` dans le presse-papiers |
| **Réinitialiser** | repart d'un projet vierge (après confirmation) |

## 7. Raccourcis clavier

| Raccourci | Action |
|---|---|
| `B` `R` `F` `E` `V` | Pinceau, Zone, Remplir, Gomme, Éditer |
| `1` `2` `3` `4` | Espace naturel, Précoce, Saison, Tardive |
| `[` / `]` | Taille du pinceau − / + |
| `Maj+F` | Éditeur plein écran |
| `Ctrl+Z` / `Ctrl+Y` (ou `Ctrl+Maj+Z`) | Annuler / Rétablir |
| `Ctrl+S` | Sauvegarder en JSON |
| `Échap` | Fermer le menu, désélectionner, quitter le plein écran |
