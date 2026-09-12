"""
Anomaly Engine — Person 3's layer.
GPS cluster anomaly detection, confirmation log, incident alerts.
"""
import time
import math
from collections import deque
from typing import Optional

_incident_counter = 0

def _new_incident_id() -> str:
    global _incident_counter
    _incident_counter += 1
    return f"INC-{int(time.time())}-{_incident_counter:03d}"


class AnomalyEngine:
    def __init__(self):
        self.confirmation_log: deque = deque(maxlen=50)
        self._incident_alerts: list = []
        self._active_keys: set = set()

    # ------------------------------------------------------------------
    # Confirmation log — derived from SCADA state each tick
    # ------------------------------------------------------------------
    def update_confirmation_log(self, scada_state: dict):
        if not scada_state:
            return
        tracks = scada_state.get("tracks", {})
        signals = scada_state.get("signals", {})
        points = scada_state.get("points", {})
        ts = time.time()

        # Only S1 and S2 exist; map tracks to their protecting signal
        TRACK_SIGNAL_MAP = {"T1": "S1", "T2": "S1", "T3": "S1", "T4": "S2"}

        for section_id, occupied in tracks.items():
            signal_key = TRACK_SIGNAL_MAP.get(section_id, section_id.replace("T", "S"))
            raw_signal = signals.get(signal_key, "UNKNOWN")
            signal = raw_signal.upper() if raw_signal != "UNKNOWN" else "UNKNOWN"
            status = "Occupied" if occupied else "Clear"

            # Cross-check: occupied track with green signal = mismatch
            if occupied and signal == "GREEN":
                status = "Mismatch"
                confirmed_by = "Layer1-ALERT"
            else:
                confirmed_by = "Layer1"

            entry = {
                "junction_id": section_id,
                "status": status,
                "confirmed_at": ts,
                "confirmed_by": confirmed_by,
                "signal": signal,
            }
            # Only log changed state (avoid flooding the log with duplicates)
            if (not self.confirmation_log or
                    self.confirmation_log[-1].get("junction_id") != section_id or
                    self.confirmation_log[-1].get("status") != status):
                self.confirmation_log.append(entry)

    # ------------------------------------------------------------------
    # GPS cluster anomaly — coaches stopped unexpectedly
    # ------------------------------------------------------------------
    def check_gps_cluster_anomaly(self, coach_positions: list) -> list:
        if len(coach_positions) < 2:
            return []

        stopped = [c for c in coach_positions
                   if (c.get("calculated_speed") or 0) < 2.0
                   and c.get("lat") and c.get("long")]
        if len(stopped) < 2:
            return []

        avg_lat = sum(c["lat"] for c in stopped) / len(stopped)
        avg_lng = sum(c["long"] for c in stopped) / len(stopped)
        key = f"GPS_CLUSTER_{round(avg_lat, 2)}_{round(avg_lng, 2)}"

        if key in self._active_keys:
            return []
        self._active_keys.add(key)

        incident = {
            "id": _new_incident_id(),
            "type": "gps_anomaly",
            "severity": "high",
            "description": (f"{len(stopped)} coaches stopped/clustered at the same location. "
                            "Possible emergency on track."),
            "affected_trains": [c["coach_id"] for c in stopped],
            "lat": avg_lat,
            "lng": avg_lng,
            "detected_at": time.time(),
            "estimated_affected_coaches": len(stopped),
            "_key": key,
        }
        self._incident_alerts.append(incident)
        return [incident]

    # ------------------------------------------------------------------
    # Layer 1 / 3 → incident alerts
    # ------------------------------------------------------------------
    def process_layer_alerts(self, alerts: list, train_state: dict) -> list:
        trains = (train_state or {}).get("trains", {})
        new_incidents = []

        for alert in alerts:
            if alert.get("status") == "Resolved":
                continue
            key = f"INC_{alert.get('id', '')}"
            if key in self._active_keys:
                continue

            lat, lng = None, None
            for tid in alert.get("affected_id", "").split("-"):
                t = trains.get(tid)
                if t and t.get("lat"):
                    lat, lng = t["lat"], t["lng"]
                    break
            # For signal alerts (affected_id = "S1"/"S2"), fall back to nearest live train
            if lat is None and trains:
                nearest = next(
                    (t for t in trains.values() if t.get("lat") and not t.get("trainNumber", "").startswith("GHOST")),
                    None
                )
                if nearest:
                    lat, lng = nearest["lat"], nearest["lng"]

            layer = alert.get("layer", "")
            if layer == "Layer 1":
                itype, severity, coaches = "signal_mismatch", "critical", 12
            elif layer == "Layer 3":
                itype, severity, coaches = "converging_trains", "critical", 20
            else:
                continue

            incident = {
                "id": _new_incident_id(),
                "type": itype,
                "severity": severity,
                "description": alert.get("description", "Incident detected"),
                "affected_trains": alert.get("affected_id", "").split("-"),
                "lat": lat,
                "lng": lng,
                "detected_at": alert.get("detected_at", time.time()),
                "estimated_affected_coaches": coaches,
                "_key": key,
            }
            self._active_keys.add(key)
            self._incident_alerts.append(incident)
            new_incidents.append(incident)

        return new_incidents

    # ------------------------------------------------------------------
    # Cleanup resolved incidents
    # ------------------------------------------------------------------
    def clear_resolved(self, current_alerts: list):
        active_alert_ids = {
            f"INC_{a['id']}" for a in current_alerts
            if a.get("status") != "Resolved"
        }
        kept = []
        for inc in self._incident_alerts:
            key = inc.get("_key", "")
            # Keep GPS cluster incidents for 60 s then expire
            if inc["type"] == "gps_anomaly":
                if time.time() - inc["detected_at"] < 60:
                    kept.append(inc)
                else:
                    self._active_keys.discard(key)
            elif key in active_alert_ids:
                kept.append(inc)
            else:
                self._active_keys.discard(key)
        self._incident_alerts = kept

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------
    def get_confirmation_log(self) -> list:
        return list(self.confirmation_log)[-20:]

    def get_incident_alerts(self) -> list:
        return self._incident_alerts


anomaly_engine = AnomalyEngine()
