"""
Train Monitor — schedule-based real-time positioning + RailRadar GPS overlay.

Flow:
  - Every 1 second: call schedule_engine.get_realtime_position() which reads
    the permanent Indian Railways timetable and current IST to compute the
    train's exact kilometre position right now. No simulation, no multiplier.
  - If RailRadar GPS is available (not rate-limited), its position overrides
    the schedule and we do Uber-like smooth interpolation from the GPS anchor.
  - Station ETAs come from schedule_engine._upcoming() (scheduled times) with
    XGBoost delay correction applied on top.
"""

import asyncio
import time
import httpx
import os
from dotenv import load_dotenv
from geo_utils import interpolate_position, haversine
import schedule_engine

load_dotenv()

RAILRADAR_API_KEY = os.getenv("RAILRADAR_API_KEY", "")
RAILRADAR_BASE = "https://api.railradar.in/v1"


def _route_coords(route: dict) -> list:
    """Extract [lng, lat] coordinate list from GeoJSON."""
    if not route:
        return []
    geom = route.get("geometry") or {}
    if geom.get("type") == "LineString":
        return geom.get("coordinates", [])
    for feat in route.get("features", []):
        g = feat.get("geometry", {})
        if g.get("type") == "LineString":
            return g.get("coordinates", [])
    return []


# Fallback routes disabled to enforce high-res RailRadar GeoJSON paths
FALLBACK_ROUTES: dict[str, list] = {}

TRAIN_META: dict[str, dict] = {
    "12841": {
        "trainName": "12841 Coromandel Express",
        "totalDistanceKm": 1663.0,
    },
    "12952": {
        "trainName": "12952 New Delhi Rajdhani",
        "totalDistanceKm": 1384.0,
    },
    "12859": {
        "trainName": "12859 Gitanjali Express",
        "totalDistanceKm": 1968.0,
    },
    "14707": {
        "trainName": "14707 Ranakpur Express",
        "totalDistanceKm": 1218.0,
    },
}


class TrainMonitor:
    def __init__(self):
        self.monitored_trains: list[str] = ["12841", "12952"]
        self.live_trains: dict = {}
        self.ghost_trains: dict = {}
        self.routes: dict = {}

        # RailRadar GPS snapshots (used when API is not rate-limited)
        self._snapshots: dict = {}
        self._snap_time: dict = {}

        self.simulation_active = False
        self.sim_state: dict = {}
        self.last_api_fetch: float = 0.0
        self.api_fetch_interval: int = 120  # 2 minutes — preserves monthly quota

        self._init_fallback_routes()

    def _init_fallback_routes(self):
        for train_num, coords in FALLBACK_ROUTES.items():
            if train_num not in self.routes:
                self.routes[train_num] = {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_monitored_trains(self, trains: list[str]):
        self.monitored_trains = [str(t).strip() for t in trains if str(t).strip()]
        self.live_trains.clear()
        self._snapshots.clear()
        self._snap_time.clear()
        self.last_api_fetch = 0.0
        self._init_fallback_routes()

    def get_cached_route(self, train_num: str) -> dict:
        return self.routes.get(train_num, {})

    def get_state(self) -> dict:
        merged = {**self.live_trains, **self.ghost_trains}
        return {
            "type": "train_state",
            "timestamp": time.time(),
            "trains": merged,
            "railradar_active": bool(RAILRADAR_API_KEY),
            "simulation_active": self.simulation_active,
        }

    # ------------------------------------------------------------------
    # RailRadar GPS fetching (best-effort; schedule used when rate-limited)
    # ------------------------------------------------------------------

    async def _fetch_route(self, client: httpx.AsyncClient, train_num: str):
        if train_num in self.routes and _route_coords(self.routes[train_num]):
            return
        headers = {"Authorization": f"Bearer {RAILRADAR_API_KEY}"}
        try:
            r = await client.get(f"{RAILRADAR_BASE}/trains/{train_num}/route", headers=headers)
            if r.status_code == 200:
                data = r.json()
                geojson = (data.get("data") or {}).get("geojson") or data.get("data") or {}
                self.routes[train_num] = geojson
                print(f"RailRadar: route fetched for {train_num}")
            else:
                print(f"RailRadar: route {train_num} -> {r.status_code}")
        except Exception as e:
            print(f"RailRadar: route fetch error {train_num}: {e}")

    async def _fetch_live(self, client: httpx.AsyncClient, train_num: str):
        headers = {"Authorization": f"Bearer {RAILRADAR_API_KEY}"}
        try:
            r = await client.get(f"{RAILRADAR_BASE}/trains/{train_num}/live", headers=headers)
            if r.status_code == 200:
                data = r.json()
                if data.get("success") and data.get("data"):
                    self._parse_and_store_snapshot(train_num, data["data"])
                    return True
            elif r.status_code == 429:
                print(f"RailRadar: rate-limited for {train_num} -- using timetable")
            else:
                print(f"RailRadar: live {train_num} -> {r.status_code}")
        except Exception as e:
            print(f"RailRadar: live fetch error {train_num}: {e}")
        return False

    def _parse_and_store_snapshot(self, train_num: str, d: dict):
        loc = d.get("currentLocation") or {}
        train_info = d.get("train") or {}

        dist_km = float(loc.get("distanceFromOriginKm") or 0)
        delay = float(loc.get("delayMinutes") or d.get("delayMinutes") or 0)
        avg_speed = float(train_info.get("avgSpeed") or 60) or 60
        total_km = float(train_info.get("distance") or TRAIN_META.get(train_num, {}).get("totalDistanceKm") or 1000)

        # Get current segment speed from route data
        current_seq = loc.get("sequence", 0)
        current_speed = avg_speed
        for stop in (d.get("route") or []):
            if stop.get("sequence") == current_seq:
                current_speed = float(stop.get("speedToNextStationKmph") or avg_speed)
                break

        # Interpolate lat/lng from route since API doesn't provide coordinates
        coords = _route_coords(self.routes.get(train_num, {}))
        pos = interpolate_position(coords, dist_km) if coords else None
        if pos:
            anchor_lat, anchor_lng = pos
        else:
            src = train_info.get("source") or {}
            anchor_lat = float(src.get("lat") or 22.0)
            anchor_lng = float(src.get("lng") or 78.0)

        # Extract upcoming halts from route list
        upcoming = []
        for stop in (d.get("route") or []):
            if stop.get("status") == "upcoming" and stop.get("isHalt"):
                upcoming.append({
                    "stationName": stop.get("stationName", ""),
                    "stationCode": stop.get("stationCode", ""),
                    "distanceFromOriginKm": float(stop.get("distance") or 0),
                    "scheduledArrival": stop.get("scheduledArrival", ""),
                    "expectedArrival": stop.get("expectedArrival") or stop.get("scheduledArrival", ""),
                })

        src_info = train_info.get("source") or {}
        dst_info = train_info.get("destination") or {}

        self._snapshots[train_num] = {
            "trainNumber": train_num,
            "trainName": d.get("trainName") or train_info.get("name") or TRAIN_META.get(train_num, {}).get("trainName") or train_num,
            "status": d.get("status") or loc.get("status") or "running",
            "isLive": True,
            "delayMinutes": delay,
            "currentStation": loc.get("stationName") or "—",
            "distanceFromOriginKm": dist_km,
            "totalDistanceKm": total_km,
            "avgSpeed": avg_speed,
            "segmentSpeed": current_speed,
            "source": src_info.get("name") or "",
            "destination": dst_info.get("name") or "",
            "anchor_lat": anchor_lat,
            "anchor_lng": anchor_lng,
            "anchor_dist_km": dist_km,
            "upcoming_stations": upcoming,
            "base_route": train_num,
        }
        self._snap_time[train_num] = time.time()
        print(f"RailRadar GPS: {train_num} @ {dist_km:.1f}km speed={current_speed:.1f}km/h (avg {avg_speed:.1f}) delay={delay:.0f}min station={loc.get('stationName')}")

    async def _do_api_fetch(self):
        if not RAILRADAR_API_KEY or self.simulation_active:
            return
        async with httpx.AsyncClient(timeout=10.0) as client:
            for train_num in self.monitored_trains:
                await self._fetch_route(client, train_num)
                await self._fetch_live(client, train_num)

    # ------------------------------------------------------------------
    # Real-time position from Indian Railways timetable (primary source)
    # ------------------------------------------------------------------

    def _update_from_schedule(self, train_num: str) -> bool:
        """Compute real-time position from the permanent Indian Railways timetable.

        Uses datetime.now(IST) internally so position is genuinely live and
        advances every second without any simulation multiplier.
        """
        snap = self._snapshots.get(train_num, {})
        delay = snap.get("delayMinutes", 0.0)
        meta = TRAIN_META.get(train_num, {})

        pos = schedule_engine.get_realtime_position(train_num, delay)
        if not pos:
            return False

        coords = _route_coords(self.routes.get(train_num, {}))
        map_pos = interpolate_position(coords, pos["dist_km"]) if coords else None

        station_etas = self._build_schedule_etas(pos, delay)

        self.live_trains[train_num] = {
            "trainNumber": train_num,
            "trainName": meta.get("trainName") or snap.get("trainName") or train_num,
            "status": "running",
            "isLive": False,
            "delayMinutes": delay,
            "currentStation": pos["current_station"],
            "nextStation": pos.get("next_station", ""),
            "nextStationCode": pos.get("next_station_code", ""),
            "distanceFromOriginKm": round(pos["dist_km"], 2),
            "totalDistanceKm": pos["total_km"],
            "avgSpeed": pos["speed_kmh"],
            "segmentSpeed": pos["speed_kmh"],
            "pct_journey": pos["pct_journey"],
            "source": pos["source"],
            "destination": pos["destination"],
            "lat": map_pos[0] if map_pos else snap.get("anchor_lat", 0),
            "lng": map_pos[1] if map_pos else snap.get("anchor_lng", 0),
            "base_route": train_num,
            "stationETAs": station_etas,
        }
        return True

    def _build_schedule_etas(self, pos: dict, delay: float) -> list:
        """Attach XGBoost delay prediction to each upcoming scheduled station."""
        upcoming = pos.get("upcoming", [])
        speed = max(pos["speed_kmh"], 1.0)
        results = []

        for u in upcoming:
            dist_remaining = u["distanceFromOriginKm"] - pos["dist_km"]
            if dist_remaining <= 0:
                continue
            try:
                from eta_engine import predict_station_delay
                pred_delay = predict_station_delay(delay, dist_remaining, speed)
            except Exception:
                pred_delay = round(delay + dist_remaining * 0.05, 1)

            results.append({
                "station_name": u["stationName"],
                "station_code": u["stationCode"],
                "dist_km": u["distanceFromOriginKm"],
                "dist_remaining_km": round(dist_remaining, 1),
                "predicted_delay_min": pred_delay,
                "eta_timestamp": u["eta_timestamp"],
                "scheduled_arrival": u["scheduledArrival"],
                "expected_arrival": u["scheduledArrival"],
            })

        return results[:10]

    # ------------------------------------------------------------------
    # Uber-like interpolation for live RailRadar GPS trains
    # ------------------------------------------------------------------

    def _interpolate_live_train(self, train_num: str, snap: dict):
        """Advance a live GPS train by 1 second using its last known speed."""
        elapsed = time.time() - self._snap_time.get(train_num, time.time())
        speed = snap["avgSpeed"]
        current_dist = min(snap["anchor_dist_km"] + speed * elapsed / 3600.0,
                           snap["totalDistanceKm"])

        coords = _route_coords(self.routes.get(train_num, {}))
        pos = interpolate_position(coords, current_dist) if coords else None
        lat, lng = pos if pos else (snap["anchor_lat"], snap["anchor_lng"])

        station_etas = self._compute_live_station_etas(snap, current_dist)

        self.live_trains[train_num] = {
            **snap,
            "lat": lat,
            "lng": lng,
            "distanceFromOriginKm": round(current_dist, 2),
            "stationETAs": station_etas,
        }

    def _compute_live_station_etas(self, snap: dict, current_dist: float) -> list:
        upcoming = snap.get("upcoming_stations") or []
        speed = max(snap["avgSpeed"], 1.0)
        delay = snap["delayMinutes"]
        results = []

        for stop in upcoming:
            stop_dist = float(stop.get("distanceFromOriginKm")
                              or stop.get("dist_km") or 0)
            if stop_dist <= current_dist + 1:
                continue
            dist_remaining = stop_dist - current_dist
            try:
                from eta_engine import predict_station_delay
                pred_delay = predict_station_delay(delay, dist_remaining, speed)
            except Exception:
                pred_delay = round(delay + dist_remaining * 0.05, 1)

            eta_ts = time.time() + (dist_remaining / speed) * 3600

            results.append({
                "station_name": stop.get("stationName") or stop.get("station_name") or "—",
                "station_code": stop.get("stationCode") or stop.get("station_code") or "",
                "dist_km": stop_dist,
                "dist_remaining_km": round(dist_remaining, 1),
                "predicted_delay_min": pred_delay,
                "eta_timestamp": round(eta_ts),
                "scheduled_arrival": stop.get("scheduledArrival") or "",
                "expected_arrival": stop.get("expectedArrival") or "",
            })

        return results

    # ------------------------------------------------------------------
    # Per-tick update dispatcher
    # ------------------------------------------------------------------

    def _update_all(self):
        for train_num in self.monitored_trains:
            snap = self._snapshots.get(train_num)
            # Use GPS interpolation if we have a fresh live snapshot (< 90s)
            if snap and snap.get("isLive") and (time.time() - self._snap_time.get(train_num, 0)) < 90:
                self._interpolate_live_train(train_num, snap)
                continue

            # Try schedule-based position
            if self._update_from_schedule(train_num):
                continue

            # Use stale GPS snapshot if we have one (better than nothing)
            if snap:
                self._interpolate_live_train(train_num, snap)
                continue

            # Last resort: create a visible placeholder so the train appears
            if train_num not in self.live_trains:
                self.live_trains[train_num] = {
                    "trainNumber": train_num,
                    "trainName": f"Train {train_num} (loading...)",
                    "status": "waiting",
                    "isLive": False,
                    "delayMinutes": 0,
                    "currentStation": "Fetching data...",
                    "nextStation": "",
                    "distanceFromOriginKm": 0,
                    "totalDistanceKm": 0,
                    "avgSpeed": 0,
                    "pct_journey": 0,
                    "source": "",
                    "destination": "",
                    "lat": 22.0,
                    "lng": 78.0,
                    "base_route": train_num,
                    "stationETAs": [],
                }

    # ------------------------------------------------------------------
    # Convergence / fault injection
    # ------------------------------------------------------------------

    def inject_fault(self):
        self.simulation_active = True
        self.ghost_trains.clear()

        target = next(iter(self.live_trains.values()), None)
        if not target:
            print("No live train to simulate against.")
            return

        route_coords = _route_coords(self.routes.get(target.get("base_route", ""), {}))
        if not route_coords:
            print("No route coords for simulation.")
            return

        self.sim_state = {
            "target_id": target["trainNumber"],
            "route_coords": route_coords,
            "dist_target": target["distanceFromOriginKm"],
            "dist_ghost": target["distanceFromOriginKm"] + 50.0,
        }
        self.ghost_trains["GHOST_SIM"] = {
            "trainNumber": "GHOST_SIM",
            "trainName": "Unscheduled Goods Train",
            "status": "DANGER",
            "isLive": False,
            "delayMinutes": 0,
            "currentStation": "Approaching Head-On",
            "lat": 0.0, "lng": 0.0,
            "distanceFromOriginKm": self.sim_state["dist_ghost"],
            "avgSpeed": 100,
            "base_route": target.get("base_route", ""),
            "stationETAs": [],
        }
        print(f"Convergence simulation started: ghost 50km ahead of {target['trainNumber']}")

    def inject_signal_fault(self):
        self.ghost_trains.clear()
        target = next(iter(self.live_trains.values()), None)
        if not target:
            print("No live train to spawn signal fault against.")
            return

        route_coords = _route_coords(self.routes.get(target.get("base_route", ""), {}))
        if not route_coords:
            return

        fault_dist = target["distanceFromOriginKm"] + 5.0
        pos = interpolate_position(route_coords, fault_dist)
        if not pos:
            return

        self.ghost_trains["GHOST_SIGNAL"] = {
            "trainNumber": "GHOST_SIGNAL",
            "trainName": "⚠ INTERLOCKING FAULT",
            "status": "MISMATCH",
            "isLive": False,
            "delayMinutes": 0,
            "currentStation": "Point Reverse / Signal Green",
            "lat": pos[0],
            "lng": pos[1],
            "distanceFromOriginKm": fault_dist,
            "avgSpeed": 0,
            "base_route": target.get("base_route", ""),
            "stationETAs": [],
        }
        print(f"Signal mismatch injected at {fault_dist}km (5km ahead of {target['trainNumber']})")

    def step_simulation(self):
        if not self.simulation_active or "GHOST_SIM" not in self.ghost_trains:
            return

        tid = self.sim_state["target_id"]

        # Check for collision
        if self.sim_state["dist_target"] >= self.sim_state["dist_ghost"]:
            if tid in self.live_trains:
                self.live_trains[tid]["avgSpeed"] = 0
                self.live_trains[tid]["status"] = "COLLISION"
            self.ghost_trains["GHOST_SIM"]["avgSpeed"] = 0
            self.ghost_trains["GHOST_SIM"]["status"] = "COLLISION"
            return  # Freeze, don't update positions anymore

        self.sim_state["dist_target"] += 1.5
        self.sim_state["dist_ghost"] -= 1.5

        coords = self.sim_state["route_coords"]
        
        t_pos = interpolate_position(coords, self.sim_state["dist_target"])
        g_pos = interpolate_position(coords, self.sim_state["dist_ghost"])

        if tid in self.live_trains and t_pos:
            self.live_trains[tid]["lat"] = t_pos[0]
            self.live_trains[tid]["lng"] = t_pos[1]
            self.live_trains[tid]["avgSpeed"] = 140
            self.live_trains[tid]["distanceFromOriginKm"] = round(self.sim_state["dist_target"], 2)

        if g_pos:
            self.ghost_trains["GHOST_SIM"]["lat"] = g_pos[0]
            self.ghost_trains["GHOST_SIM"]["lng"] = g_pos[1]
            self.ghost_trains["GHOST_SIM"]["distanceFromOriginKm"] = round(self.sim_state["dist_ghost"], 2)

    def resolve_fault(self):
        self.simulation_active = False
        self.ghost_trains.clear()
        self.last_api_fetch = 0.0
        
        # Restore live trains instantly from snapshots
        for train_num, snap in self._snapshots.items():
            if snap:
                self._interpolate_live_train(train_num, snap)

    def check_convergence(self) -> list:
        if not self.simulation_active:
            return []
        merged = {**self.live_trains, **self.ghost_trains}
        ids = list(merged.keys())
        alerts = []
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a, b = merged[ids[i]], merged[ids[j]]
                if a.get("lat") and b.get("lat"):
                    dist = haversine(a["lng"], a["lat"], b["lng"], b["lat"])
                    if dist < 15.0:
                        alerts.append({
                            "type": "layer3_alert",
                            "layer": "Layer 3",
                            "source": "RailRadar Dynamic Monitor",
                            "timestamp": time.time(),
                            "description": (
                                f"URGENT CONVERGENCE: {a.get('trainName')} and "
                                f"{b.get('trainName')} are converging on the same "
                                f"block section! Separation: {dist:.1f} km."
                            ),
                            "affected_id": f"{ids[i]}-{ids[j]}",
                        })
        return alerts

    # ------------------------------------------------------------------
    # Background run loop — 1 tick = 1 second
    # ------------------------------------------------------------------

    async def run(self):
        while True:
            await asyncio.sleep(1.0)

            if self.simulation_active:
                self.step_simulation()
            else:
                now = time.time()
                if now - self.last_api_fetch >= self.api_fetch_interval:
                    self.last_api_fetch = now
                    await self._do_api_fetch()

                self._update_all()


train_monitor = TrainMonitor()
