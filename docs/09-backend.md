---
title: Brancher son backend
icon: plug
---

# Brancher son propre backend de simulation

DrosoSim Next calcule par défaut **dans le navigateur** avec son moteur TypeScript. Mais l'interface (éditeur, leviers, résultats, exports) est **découplée du calcul** : une équipe de recherche peut y brancher **son propre modèle** (EDO SciPy, modèle INRAE, code R, Fortran, Rust…) sans toucher à l'interface.

![Architecture](assets/architecture.svg)

## 1. Principe

```
Éditeur + leviers ──► useSimulation() ──► backend.run(SimRequest) ──► SimOutput ──► Résultats
                                           │
                                           ├─ local : moteur TS (Web Worker) — par défaut
                                           ├─ http  : POST JSON vers votre serveur
                                           └─ ws    : WebSocket (calculs longs)
```

- Le contrat d'échange est défini dans **`src/lib/backend.ts`** (version `1`).
- À chaque modification, l'application envoie une `SimRequest` et attend une `SimOutput`. Les appels distants sont regroupés (délai de 350 ms) et seule la dernière réponse est affichée.
- **Repli automatique** : si le backend distant échoue (serveur arrêté, erreur 4xx/5xx, délai de 60 s dépassé), le calcul bascule sur le moteur local. Le badge passe à l'orange (*Secours local*) et l'erreur s'affiche au survol.
- Le badge de calcul indique la source : 🟢 *Temps réel* (local), 🔵 *Backend HTTP / WebSocket*, 🟠 *Secours local*.

## 2. Sélectionner un backend

### Par variables d'environnement (déploiement)

Copiez `.env.example` en `.env.local` à la racine du projet, puis adaptez :

```bash
NEXT_PUBLIC_SIM_BACKEND=http                               # local | http | ws
NEXT_PUBLIC_SIM_BACKEND_URL=https://api.mon-labo.fr/simulate
```

puis relancez `npm run dev` (ou reconstruisez avec `npm run build`).

### À chaud, sans reconstruire (développement, démonstration)

Ajoutez `?backend=` à n'importe quelle adresse de l'application :

| Adresse | Effet |
|---|---|
| `/simulator?backend=http://localhost:8788/simulate` | backend HTTP |
| `/simulator?backend=ws://localhost:8790/simulate` | backend WebSocket (détecté par le préfixe `ws`) |
| `/simulator?backend=local` | retour au moteur local |

Le choix est mémorisé dans le navigateur (`localStorage`, clé `drososim-backend`) jusqu'au prochain `?backend=`.

## 3. Le contrat d'échange (version 1)

### Requête `SimRequest` (envoyée par l'application)

```jsonc
{
  "version": 1,
  "gridSize": 20,
  "grid": ["forest", "forest", "…", "neutral"],      // 400 cases, index = y * 20 + x
  "parcels": [                                        // parcelles détectées (cases contiguës)
    { "id": "late-cherry-1", "name": "Cerise Tardive-1", "type": "late-cherry", "cells": [105, 106, "…"] }
  ],
  "strategies": [
    { "id": "baseline", "name": "Témoin sans protection", "isBaseline": true, "leversByParcel": {} },
    { "id": "strategy-a", "name": "Stratégie A", "isBaseline": false,
      "leversByParcel": {
        "late-cherry-1": {
          "prophylaxis": true,  "harvestRate": 98, "groundFruitDestruction": true,
          "netting": true,      "netType": "monorang", "netDeploy": "bloom",
          "treatment": false,   "treatmentMode": "conventional", "treatmentPasses": 2, "treatmentTrigger": "calendar",
          "parasitoids": false, "parasitoidSeason": "spring", "parasitoidDose": "standard",
          "tis": false,         "tisRatio": 10
        } } }
  ],
  "params": { "startSeason": "spring", "durationYears": 2, "climateProfile": "mild-winter" },
  "eco": { "yieldTPerHa": 10, "pricePerKg": 3.5, "cellAreaM2": 100,
           "costs": { "netMonorang": 3800, "netMonoparcelle": 2600, "laborHour": 16, "phytoConv": 85,
                      "phytoBio": 150, "parasitoidStd": 300, "parasitoidReinf": 520, "tis": 950 } }
}
```

Types de cases : `neutral`, `forest`, `early-cherry`, `season-cherry`, `late-cherry`.
Profils climatiques : `mild-winter`, `harsh-winter`, `humid-spring`, `dry-summer`.

### Réponse `SimOutput` (renvoyée par votre backend)

**Réponse minimale** — seul `results[].harvestByParcel` est indispensable :

```json
{
  "results": [
    { "id": "baseline",   "harvestByParcel": { "early-cherry-1": 97.5, "late-cherry-1": 46.2 } },
    { "id": "strategy-a", "harvestByParcel": { "early-cherry-1": 99.1, "late-cherry-1": 98.7 } }
  ]
}
```

L'application **complète automatiquement** ce qui manque (fonction `normalizeOutput`) :

| Champ (par stratégie) | Rôle dans l'interface | Si absent |
|---|---|---|
| `harvestByParcel` | **% de récolte saine** par parcelle de cerisiers | — (requis) |
| `harvestByParcelYear` | graphique « année après année » | une seule valeur par parcelle |
| `series` | courbes de dynamique : `[{ "day": 0, "label": "1 mars A1", "<parcelId>": 1234, "cherry_all": 800, "forest_all": 3000 }, …]` | graphiques vides |
| `damageSeries` | courbe des fruits sains : `[{ "day": 0, "<parcelId>": 100 }, …]` | graphique vide |
| `peakByCell` | carte de pression (400 valeurs, femelles/ha) | carte neutre |
| `peakDensity` | pic de femelles/ha | max de `peakByCell` |
| `globalHarvest` | récolte globale | moyenne pondérée par la surface |
| `revenue` | chiffre d'affaires | calculé avec `eco` |
| `costs`, `totalCost`, `ift`, `laborHours` | bilan économique et environnemental | 0 |
| `events` | marqueurs 🚜 🛡️ 🧺 🐝 🧬 : `[{ "day": 140, "type": "treatment", "parcelId": "…" }]` | aucun marqueur |

Champs globaux optionnels : `computeMs`, `totalDays`, `startDayOfYear`, `phenology`.

Les **jours** (`day`) sont comptés depuis le début de la simulation : jour 0 = 1er mars (départ printemps) ou 1er octobre (départ automne).

**Erreurs** : renvoyez un code HTTP 4xx/5xx avec `{ "error": "message" }`. Le message s'affiche au survol du badge et l'application bascule sur le moteur local.

### Protocole WebSocket

- Client → serveur : `{ "type": "simulate", "id": 12, …SimRequest }`
- Serveur → client : `{ "id": 12, "out": { …SimOutput } }` ou `{ "id": 12, "error": "…" }`

La connexion est réutilisée, et plusieurs requêtes peuvent être en vol (corrélées par `id`).

## 4. Exemples fournis

### Backend de référence Node (le moteur de l'application derrière HTTP)

```bash
npm run backend:node                           # → http://localhost:8787/simulate
# test sans interface, avec une requête réelle :
curl -s -X POST localhost:8787/simulate -H 'Content-Type: application/json' --data @examples/requete-exemple.json
```

Ouvrez ensuite `http://localhost:3000/results?backend=http://localhost:8787/simulate` : les résultats doivent être identiques au moteur local. Ce backend sert de **test de conformité** du contrat.

### Squelette Python (sans dépendance)

```bash
npm run backend:python                         # → http://localhost:8788/simulate
```

Le fichier `examples/backend-python/server.py` contient :
1. **`run_model(req)`** — un modèle factice à remplacer par le vôtre ;
2. **`from_inrae_output(...)`** — un adaptateur qui convertit une sortie de type drososim.fr (`Fertile_Females`, `Mix_Females`, `damages[année][parcelle]`) vers ce contrat ;
3. un **serveur HTTP** avec CORS ouvert, prêt pour le développement.

### Version FastAPI (production)

Le fichier [`examples/backend-python/app_fastapi.py`](../examples/backend-python/app_fastapi.py) est prêt à l'emploi :

```bash
pip install -r examples/backend-python/requirements.txt
uvicorn app_fastapi:app --app-dir examples/backend-python --host 0.0.0.0 --port 8788
```

Son principe, en résumé :

```python
# pip install fastapi uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from server import run_model            # réutilise votre fonction

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["https://drososim.mon-domaine.fr"], allow_methods=["*"], allow_headers=["*"])

@app.post("/simulate")
def simulate(req: dict):
    return run_model(req)

@app.websocket("/simulate")
async def simulate_ws(ws: WebSocket):
    await ws.accept()
    while True:
        msg = await ws.receive_json()
        try:
            await ws.send_json({"id": msg["id"], "out": run_model(msg)})
        except Exception as e:
            await ws.send_json({"id": msg["id"], "error": str(e)})
```

## 5. Recommandations pour un backend de recherche

- **Temps de réponse** : l'interface reste utilisable avec des calculs de plusieurs secondes (badge *Calcul…*), mais l'expérience « temps réel » demande moins de 500 ms. Pensez au cache (même requête → même réponse) et au calcul parallèle des stratégies.
- **Témoin** : la stratégie `isBaseline: true` doit être calculée sans aucun levier.
- **Correspondance des leviers** : chaque levier a des réglages précis (voir le chapitre *Les leviers*). Si votre modèle raisonne en interventions datées (comme drososim.fr), convertissez les réglages en dates à partir de la phénologie (`src/lib/engine.ts`, constante `PHENOLOGY`).
- **Sécurité** : en production, restreignez CORS au domaine de l'application, imposez une taille de requête maximale et une limite de débit.
- **Versionnement** : vérifiez `req.version` et renvoyez une erreur explicite si elle n'est pas supportée.

## 6. Ajouter un autre type de backend

Implémentez l'interface dans `src/lib/backend.ts` :

```ts
export interface SimulationBackend {
  readonly mode: BackendMode;
  readonly label: string;               // affiché au survol du badge
  run(req: SimRequest): Promise<SimOutput>;
}
```

Exemple : un backend **WebAssembly** (moteur Rust compilé) peut charger le module `.wasm` une fois, puis appeler une fonction exportée dans `run()`. Pour l'activer, ajoutez-le dans `getBackend()`.
