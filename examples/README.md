# Exemples de backends de simulation

Ces exemples montrent comment brancher **son propre modèle** sur DrosoSim Next. Le contrat d'échange complet est décrit dans [`docs/09-backend.md`](../docs/09-backend.md).

| Dossier / fichier | Rôle | Dépendances |
|---|---|---|
| [`backend-node/server.ts`](backend-node/server.ts) | **Référence** : le moteur de l'application derrière HTTP (test de conformité) | aucune (Node ≥ 22) |
| [`backend-python/server.py`](backend-python/server.py) | **Squelette** : `run_model()` à remplacer et adaptateur pour un modèle de type DrosoSim INRAE | aucune (Python ≥ 3.9) |
| [`backend-python/app_fastapi.py`](backend-python/app_fastapi.py) | Version **production** (HTTP + WebSocket, CORS configurable) | `requirements.txt` |
| [`requete-exemple.json`](requete-exemple.json) | Requête réelle (verger de démonstration, témoin + protection intégrée) | — |

## Démarrer

```bash
npm run backend:node        # → http://localhost:8787/simulate
npm run backend:python      # → http://localhost:8788/simulate
```

Version FastAPI :

```bash
pip install -r examples/backend-python/requirements.txt
uvicorn app_fastapi:app --app-dir examples/backend-python --port 8788
```

## Tester sans l'interface

```bash
curl -s localhost:8787/health
curl -s -X POST localhost:8787/simulate -H 'Content-Type: application/json' \
     --data @examples/requete-exemple.json | head -c 300
```

## Brancher sur l'application

```
http://localhost:3000/simulator?backend=http://localhost:8788/simulate
```

ou de façon permanente dans `.env.local` (voir [`.env.example`](../.env.example)). Si le backend échoue, l'application bascule automatiquement sur son moteur local.
