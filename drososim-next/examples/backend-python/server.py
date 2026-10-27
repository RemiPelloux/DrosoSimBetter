"""
Squelette de backend Python pour DrosoSim Next — bibliothèque standard uniquement.

    python3 examples/backend-python/server.py          # écoute sur :8788
    puis ouvrir http://localhost:3000/simulator?backend=http://localhost:8788/simulate

Remplacez `run_model()` par l'appel à votre modèle (EDO SciPy, modèle INRAE,
code Fortran/R, etc.). Le contrat d'échange est décrit dans docs/09-backend.md.
Pour un serveur de production : FastAPI/Uvicorn, voir la documentation.
"""
from __future__ import annotations

import json
import math
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8788
CHERRY = {"early-cherry", "season-cherry", "late-cherry"}
# fenêtres de sensibilité (véraison, récolte) en jour de l'année — identiques au front
PHENOLOGY = {"early-cherry": (130, 158), "season-cherry": (150, 178), "late-cherry": (168, 200)}


# =============================================================================
# 1) VOTRE MODÈLE — à remplacer
# =============================================================================
def run_model(req: dict) -> dict:
    """
    MODÈLE FACTICE, uniquement pour illustrer le format de sortie.
    Reçoit la requête du front, renvoie un dict { "results": [...] }.

    Champs minimaux par stratégie : id, harvestByParcel (% de récolte saine par
    parcelle de cerisiers). Tout le reste est optionnel : le front recalcule la
    récolte globale, le chiffre d'affaires et la phénologie si besoin.
    """
    grid, parcels, years = req["grid"], req["parcels"], req["params"]["durationYears"]
    n = req.get("gridSize", 20)
    forest = {i for i, c in enumerate(grid) if c == "forest"}

    def forest_pressure(cells: list[int]) -> float:
        # proportion de cases de la parcelle à moins de 3 cases d'une forêt
        near = 0
        for c in cells:
            x, y = c % n, c // n
            if any(abs(x - f % n) <= 3 and abs(y - f // n) <= 3 for f in forest):
                near += 1
        return near / max(1, len(cells))

    results = []
    for strat in req["strategies"]:
        harvest, harvest_year, series_vals = {}, {}, {}
        for p in parcels:
            if p["type"] not in CHERRY:
                continue
            lever = strat["leversByParcel"].get(p["id"], {}) if not strat["isBaseline"] else {}
            # dégâts de base : plus forts pour les variétés tardives et près des bois
            base = {"early-cherry": 0.15, "season-cherry": 0.45, "late-cherry": 0.7}[p["type"]]
            dmg = base * (0.5 + forest_pressure(p["cells"]))
            for key, eff in (("netting", 0.9), ("prophylaxis", 0.3), ("treatment", 0.5), ("parasitoids", 0.2), ("tis", 0.4)):
                if lever.get(key):
                    dmg *= 1 - eff
            per_year = [round(max(0.0, 100 * (1 - min(1.0, dmg * (1 + 0.15 * y)))), 1) for y in range(years)]
            harvest_year[p["id"]] = per_year
            harvest[p["id"]] = round(sum(per_year) / len(per_year), 1)
            series_vals[p["id"]] = dmg

        # série temporelle indicative (femelles/ha) tous les 3 jours
        total_days = years * 365
        start = 59 if req["params"]["startSeason"] == "spring" else 273
        series = []
        for d in range(0, total_days, 3):
            doy = (start + d) % 365
            season = max(0.0, math.sin(math.pi * (doy - 120) / 200)) if 120 < doy < 320 else 0.0
            pt = {"day": d, "label": f"j{d}"}
            for pid, dmg in series_vals.items():
                pt[pid] = round(40000 * season * dmg)
            series.append(pt)

        results.append({
            "id": strat["id"], "name": strat["name"], "isBaseline": strat["isBaseline"],
            "harvestByParcel": harvest, "harvestByParcelYear": harvest_year, "series": series,
        })
    return {"results": results}


# =============================================================================
# 2) ADAPTATEUR pour un modèle à la DrosoSim INRAE (exemple)
# =============================================================================
def from_inrae_output(strategy: dict, solution: dict, damages: dict) -> dict:
    """
    Convertit une sortie de type drososim.fr :
      solution[parcelle] = {"Fertile_Females": {...}, "Mix_Females": {...}}  (séries pandas)
      damages[année][parcelle] = % de dégâts
    vers le format attendu par DrosoSim Next.
    """
    parcels = list(solution.keys())
    n = len(next(iter(solution.values()))["Fertile_Females"]) if parcels else 0
    series = []
    for i in range(0, n, 3):
        pt = {"day": i, "label": f"j{i}"}
        for pid in parcels:
            ff = list(solution[pid]["Fertile_Females"].values())[i]
            mf = list(solution[pid]["Mix_Females"].values())[i]
            pt[pid] = ff + 0.5 * mf
        series.append(pt)
    years = sorted(damages)
    hby = {pid: [100 - damages[y].get(pid, 0) for y in years] for pid in parcels if any(pid in damages[y] for y in years)}
    return {
        "id": strategy["id"], "name": strategy["name"], "isBaseline": strategy["isBaseline"],
        "harvestByParcel": {pid: sum(v) / len(v) for pid, v in hby.items()},
        "harvestByParcelYear": hby, "series": series,
    }


# =============================================================================
# 3) SERVEUR HTTP (CORS ouvert pour le développement)
# =============================================================================
class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict | None = None) -> None:
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if payload is not None:
            self.wfile.write(json.dumps(payload).encode())

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204)

    def do_GET(self) -> None:  # noqa: N802
        self._send(200, {"status": "ok"} if self.path == "/health" else {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self.path.startswith("/simulate"):
            return self._send(404, {"error": "not found"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            if req.get("version") != 1:
                raise ValueError(f"version de contrat non supportée : {req.get('version')}")
            t0 = time.perf_counter()
            out = run_model(req)
            out["computeMs"] = (time.perf_counter() - t0) * 1000
            self._send(200, out)
        except Exception as e:  # renvoyé au front, qui bascule sur le moteur local
            self._send(400, {"error": str(e)})

    def log_message(self, fmt: str, *args) -> None:
        print("[backend-python]", fmt % args)


if __name__ == "__main__":
    print(f"Backend DrosoSim (Python) → http://localhost:{PORT}/simulate")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
