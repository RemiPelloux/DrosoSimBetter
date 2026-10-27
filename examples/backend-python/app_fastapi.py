"""
Backend DrosoSim Next — version production (FastAPI + Uvicorn), HTTP et WebSocket.

    pip install -r examples/backend-python/requirements.txt
    uvicorn app_fastapi:app --app-dir examples/backend-python --host 0.0.0.0 --port 8788

Réutilise `run_model()` de server.py : remplacez-le par votre modèle.
Configurez ALLOWED_ORIGINS (séparées par des virgules) pour restreindre CORS.
"""
from __future__ import annotations

import os
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from server import run_model

CONTRACT_VERSION = 1
app = FastAPI(title="DrosoSim Next — backend de simulation", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _simulate(req: dict) -> dict:
    if req.get("version") != CONTRACT_VERSION:
        raise ValueError(f"version de contrat non supportée : {req.get('version')}")
    t0 = time.perf_counter()
    out = run_model(req)
    out["computeMs"] = (time.perf_counter() - t0) * 1000
    return out


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "contract": CONTRACT_VERSION}


@app.post("/simulate")
def simulate(req: dict) -> dict:
    try:
        return _simulate(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.websocket("/simulate")
async def simulate_ws(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_json()
            try:
                await ws.send_json({"id": msg.get("id"), "out": _simulate(msg)})
            except Exception as e:  # l'erreur est renvoyée au front, qui bascule sur le moteur local
                await ws.send_json({"id": msg.get("id"), "error": str(e)})
    except WebSocketDisconnect:
        pass
