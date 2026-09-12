import asyncio
import json
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from scada_simulator import scada_sim
from verification_engine import VerificationEngine
from train_monitor import train_monitor
from alert_manager import alert_manager, authority_dispatch
from eta_engine import predict_for_train
from anomaly_engine import anomaly_engine
from responders import nearest_responders

PERSON2_BASE = "http://localhost:8001"

_coach_positions: list = []
_risk_scores: dict = {}


async def fetch_person2_state():
    global _coach_positions, _risk_scores
    async with httpx.AsyncClient(timeout=3.0) as client:
        while True:
            await asyncio.sleep(3.0)
            try:
                r = await client.get(f"{PERSON2_BASE}/api/v1/live-positions")
                if r.status_code == 200:
                    _coach_positions = r.json()
            except Exception:
                pass
            try:
                r2 = await client.get(f"{PERSON2_BASE}/api/v1/risk-scores-all")
                if r2.status_code == 200:
                    _risk_scores = r2.json()
            except Exception:
                pass


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

verification_engine = VerificationEngine()


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass

    async def broadcast(self, message: str):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(scada_sim.run())
    asyncio.create_task(train_monitor.run())
    asyncio.create_task(alert_manager.run_escalation_checker())
    asyncio.create_task(broadcast_state_loop())
    asyncio.create_task(fetch_person2_state())


async def broadcast_state_loop():
    while True:
        await asyncio.sleep(1.0)

        scada_state = scada_sim.get_state()
        layer1_alerts = verification_engine.verify_layer_1(scada_state)

        train_state = train_monitor.get_state()
        layer3_alerts = train_monitor.check_convergence()

        all_new_alerts = layer1_alerts + layer3_alerts
        alert_manager.process_new_alerts(all_new_alerts)
        all_alerts = alert_manager.get_all_alerts()

        # ETA predictions (whole-journey)
        eta_data = {}
        for tid, tdata in train_state.get("trains", {}).items():
            if not tid.startswith("GHOST"):
                pred = predict_for_train(tdata)
                if pred:
                    eta_data[tid] = pred

        # Station-level ETAs (already embedded in each train by train_monitor)
        station_etas = {}
        for tid, tdata in train_state.get("trains", {}).items():
            if not tid.startswith("GHOST") and tdata.get("stationETAs"):
                station_etas[tid] = tdata["stationETAs"]

        # Person 3 anomaly engine
        anomaly_engine.update_confirmation_log(scada_state)
        anomaly_engine.process_layer_alerts(all_alerts, train_state)
        anomaly_engine.check_gps_cluster_anomaly(_coach_positions)
        anomaly_engine.clear_resolved(all_alerts)

        # Collect live (non-ghost) train numbers for driver alerts
        live_train_numbers = [
            tid for tid in train_state.get("trains", {})
            if not tid.startswith("GHOST")
        ]

        # Attach nearest responders and auto-dispatch to authorities
        incidents = []
        for inc in anomaly_engine.get_incident_alerts():
            entry = dict(inc)
            entry.pop("_key", None)
            if inc.get("lat") and inc.get("lng"):
                responders = nearest_responders(inc["lat"], inc["lng"])
                entry["nearest_responders"] = responders
                # Auto-dispatch to authorities (idempotent — skips already-dispatched)
                authority_dispatch.dispatch_for_incident(inc, responders, live_train_numbers)
            incidents.append(entry)

        payload = {
            "scada": scada_state,
            "trains": train_state,
            "alerts": all_alerts,
            "eta": eta_data,
            "station_etas": station_etas,
            "coach_positions": _coach_positions,
            "risk_scores": _risk_scores,
            "confirmation_log": anomaly_engine.get_confirmation_log(),
            "incident_alerts": incidents,
            "authority_dispatches": authority_dispatch.get_recent(),
        }

        await manager.broadcast(json.dumps(payload))


# ── Health ──────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── Fault injection ─────────────────────────────────────────────────────

@app.get("/api/weather")
async def get_weather():
    # Pick the first monitored (non-ghost) train deterministically
    target = None
    for tid in train_monitor.monitored_trains:
        t = train_monitor.live_trains.get(tid)
        if t and t.get("lat"):
            target = t
            break
    if not target:
        target = next((t for t in train_monitor.live_trains.values() if t.get("lat") and not str(t.get("trainNumber","")).startswith("GHOST")), None)
    if not target:
        return {"status": "error", "message": "No active train"}

    lat = target.get("lat", 22.0)
    lng = target.get("lng", 78.0)
    train_name = target.get("trainName", target.get("trainNumber", "Unknown"))

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current_weather=true&hourly=precipitation"
            )
            data = resp.json()
            temp = data.get("current_weather", {}).get("temperature", 0)
            wind = data.get("current_weather", {}).get("windspeed", 0)
            precip = sum(data.get("hourly", {}).get("precipitation", [])[:3])
            flood_risk = "High (CWC Warning)" if precip > 15 else "Normal"

            return {
                "status": "ok",
                "lat": lat,
                "lng": lng,
                "train_name": train_name,
                "temperature": temp,
                "windspeed": wind,
                "weathercode": data.get("current_weather", {}).get("weathercode", 0),
                "precipitation_3h": round(precip, 1),
                "cwc_flood_risk": flood_risk
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/simulate_gps_anomaly")
async def simulate_gps_anomaly():
    # Simulate a coach violently drifting off the tracks
    import httpx
    import datetime
    
    target = next(iter(train_monitor.live_trains.values()), None)
    if not target:
        return {"status": "error", "message": "No active train"}
        
    lat = target.get("lat", 22.0)
    lng = target.get("lng", 78.0)
    
    # Simulate 3 coaches stopped/clustered at the same location (triggers cluster anomaly)
    SIM_COACHES = ["S4", "S5", "S6"]
    async def push_bad_gps():
        async with httpx.AsyncClient() as client:
            for i in range(15):
                for j, coach_id in enumerate(SIM_COACHES):
                    payload = {
                        "coach_id": coach_id,
                        "lat": lat + (j * 0.0001),
                        "long": lng + (j * 0.0001),
                        "speed": 0.0,
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }
                    try:
                        await client.post("http://localhost:8001/api/v1/position", json=payload)
                    except Exception as e:
                        print("GPS Sim Error:", e)
                await asyncio.sleep(1.0)

    asyncio.create_task(push_bad_gps())
    return {"status": "GPS anomaly simulation started"}
@app.post("/api/inject_signal_mismatch")
def inject_signal_mismatch():
    scada_sim.inject_fault()        # sets P1=reverse, T2=occupied, S1=green → triggers verification engine
    train_monitor.inject_signal_fault()  # places ghost warning marker on map
    return {"status": "Fault injected: Signal Mismatch (Balasore-style)"}


@app.post("/api/resolve_signal_mismatch")
def resolve_signal_mismatch():
    scada_sim.resolve_fault()       # restores SCADA to normal state
    train_monitor.resolve_fault()
    return {"status": "Fault resolved"}


@app.post("/api/inject_converging_trains")
def inject_converging_trains():
    train_monitor.inject_fault()
    return {"status": "Fault injected: Converging Trains"}


@app.post("/api/resolve_converging_trains")
def resolve_converging_trains():
    train_monitor.resolve_fault()
    return {"status": "Fault resolved"}


@app.post("/api/resolve_all")
def resolve_all():
    scada_sim.resolve_fault()
    train_monitor.resolve_fault()
    anomaly_engine.force_clear_all()
    return {"status": "All incidents and faults resolved"}


# ── Alert management ─────────────────────────────────────────────────────

@app.post("/api/acknowledge_alert/{alert_id}")
def acknowledge_alert(alert_id: str):
    success = alert_manager.acknowledge_alert(alert_id)
    if success:
        return {"status": "success", "message": f"Alert {alert_id} acknowledged."}
    return {"status": "error", "message": "Alert not found or already processed."}


# ── Train / Route ────────────────────────────────────────────────────────

@app.get("/api/route/{train_number}")
async def get_route(train_number: str):
    route = train_monitor.get_cached_route(train_number)
    return route or {"error": "Route not found"}


@app.get("/api/debug_trains")
def debug_trains():
    return train_monitor.get_state()


from pydantic import BaseModel


class TrainList(BaseModel):
    trains: list[str]


@app.post("/api/set_trains")
def set_trains(payload: TrainList):
    train_monitor.set_monitored_trains(payload.trains)
    return {"status": "ok", "trains": train_monitor.monitored_trains}


# ── Escalation ───────────────────────────────────────────────────────────

@app.get("/api/escalation_status")
def escalation_status():
    return {
        "escalation_timeout": alert_manager.escalation_timeout,
        "escalated_alerts": [a for a in alert_manager.get_all_alerts() if a["status"] == "Escalated"],
    }


@app.get("/api/escalation_config")
def get_escalation_config():
    return {
        "timeout_seconds": alert_manager.escalation_timeout,
        "phone_number": getattr(alert_manager, "_phone", ""),
    }


class EscalationConfigPayload(BaseModel):
    timeout_seconds: int = 15
    phone_number: str = ""


@app.post("/api/escalation_config")
def escalation_config(payload: EscalationConfigPayload):
    alert_manager.escalation_timeout = payload.timeout_seconds
    alert_manager._phone = payload.phone_number
    return {"status": "ok", "timeout_seconds": payload.timeout_seconds}


# ── ETA ──────────────────────────────────────────────────────────────────

@app.get("/api/eta_status")
def eta_status():
    import eta_engine, sys
    return {
        "model_loaded": eta_engine._model is not None,
        "load_attempted": eta_engine._load_attempted,
        "model_path": str(eta_engine._MODEL_PATH),
        "model_path_exists": eta_engine._MODEL_PATH.exists(),
        "python": sys.executable,
    }


@app.get("/api/eta/{train_number}")
def get_eta(train_number: str):
    train = train_monitor.live_trains.get(train_number)
    if not train:
        return {"error": "Train not found or not yet fetched"}
    pred = predict_for_train(train)
    return pred or {"error": "ETA model unavailable"}


@app.get("/api/station_etas/{train_number}")
def get_station_etas(train_number: str):
    train = train_monitor.live_trains.get(train_number)
    if not train:
        return {"error": "Train not found"}
    return train.get("stationETAs", [])


@app.get("/api/stations/{train_number}")
def get_stations(train_number: str):
    from schedule_engine import SCHEDULES, get_realtime_position
    sched = SCHEDULES.get(train_number)
    if not sched:
        return {"error": "Train not found"}

    # Prefer live train position, fall back to schedule-based
    current_km = 0.0
    train = train_monitor.live_trains.get(train_number)
    if train and train.get("distanceFromOriginKm") is not None:
        current_km = float(train["distanceFromOriginKm"])
    else:
        pos = get_realtime_position(train_number)
        if pos:
            current_km = pos["dist_km"]

    def fmt(m):
        if m is None:
            return None
        h, mn = divmod(int(m) % 1440, 60)
        return f"{h:02d}:{mn:02d}"

    stations_out = []
    for s in sched["stations"]:
        skm = s["km"]
        if skm < current_km - 15:
            status = "past"
        elif skm <= current_km + 15:
            status = "current"
        else:
            status = "upcoming"
        stations_out.append({
            "code": s.get("code", ""),
            "name": s["name"],
            "km": skm,
            "lat": s.get("lat"),
            "lng": s.get("lng"),
            "status": status,
            "scheduled_arr": fmt(s.get("arr")),
            "scheduled_dep": fmt(s.get("dep")),
        })

    return {
        "train_number": train_number,
        "train_name": sched["name"],
        "current_km": round(current_km, 1),
        "stations": stations_out,
    }


# ── Person 2 proxy ───────────────────────────────────────────────────────

@app.get("/api/coach_positions")
def coach_positions():
    return _coach_positions


@app.get("/api/risk_scores")
def risk_scores():
    return _risk_scores


@app.post("/api/position")
async def relay_position(request: Request):
    body = await request.json()
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.post(f"{PERSON2_BASE}/api/v1/position",
                                  json=body,
                                  headers={"Content-Type": "application/json"})
            return JSONResponse(content=r.json(), status_code=r.status_code)
        except Exception as e:
            return JSONResponse(content={"error": str(e)}, status_code=503)


@app.get("/api/risk_score")
async def risk_score(segment_id: str):
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get(f"{PERSON2_BASE}/api/v1/risk-score",
                                 params={"segment_id": segment_id})
            return JSONResponse(content=r.json(), status_code=r.status_code)
        except Exception as e:
            return JSONResponse(content={"error": str(e)}, status_code=503)


# ── Person 3 ─────────────────────────────────────────────────────────────

@app.get("/api/confirmation_log")
def confirmation_log():
    return anomaly_engine.get_confirmation_log()


@app.get("/api/incident_alerts")
def incident_alerts():
    incidents = []
    for inc in anomaly_engine.get_incident_alerts():
        entry = dict(inc)
        entry.pop("_key", None)
        if inc.get("lat") and inc.get("lng"):
            entry["nearest_responders"] = nearest_responders(inc["lat"], inc["lng"])
        incidents.append(entry)
    return incidents


@app.get("/api/nearest_responders")
def get_nearest_responders(lat: float, lng: float, n: int = 5):
    return nearest_responders(lat, lng, n)


@app.get("/api/authority_dispatches")
def get_authority_dispatches():
    return authority_dispatch.get_recent()


# ── WebSocket ─────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
