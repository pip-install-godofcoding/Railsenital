import time
import asyncio
from typing import Dict, Any
import escalation
from escalation import escalate_alert


class AlertManager:
    def __init__(self):
        self.alerts: Dict[str, Any] = {}
        self.escalation_timeout = 10
        self.alert_counter = 0

    def process_new_alerts(self, new_alerts: list):
        active_ids = []
        for a in new_alerts:
            condition_id = f"{a['layer']}_{a['affected_id']}"
            active_ids.append(condition_id)
            if condition_id not in self.alerts or self.alerts[condition_id]["status"] == "Resolved":
                self.alert_counter += 1
                alert_id = f"ALT-{self.alert_counter:04d}"
                self.alerts[condition_id] = {
                    "id": alert_id,
                    "condition_id": condition_id,
                    "layer": a["layer"],
                    "description": a["description"],
                    "status": "Detected",
                    "detected_at": time.time(),
                    "acknowledged_by": None,
                    "acknowledged_at": None,
                    "escalated_at": None,
                    "escalated_to": None,
                    "affected_id": a.get("affected_id", ""),
                }

        for cid, alert in self.alerts.items():
            if alert["status"] != "Resolved" and cid not in active_ids:
                alert["status"] = "Resolved"
                alert["resolved_at"] = time.time()

    def get_all_alerts(self) -> list:
        return list(self.alerts.values())

    def acknowledge_alert(self, alert_id: str, user: str = "Station Master") -> bool:
        for alert in self.alerts.values():
            if alert["id"] == alert_id:
                if alert["status"] in ("Detected", "Displayed"):
                    alert["status"] = "Acknowledged"
                    alert["acknowledged_by"] = user
                    alert["acknowledged_at"] = time.time()
                    return True
        return False

    async def run_escalation_checker(self):
        while True:
            try:
                await asyncio.sleep(2)
                now = time.time()
                for alert in list(self.alerts.values()):
                    if alert["status"] in ("Detected", "Displayed"):
                        if now - alert["detected_at"] > self.escalation_timeout:
                            alert["status"] = "Escalated"
                            alert["escalated_at"] = now
                            alert["escalated_to"] = escalation.ESCALATION_TARGET
                            try:
                                msg = escalate_alert(alert)
                                alert["escalation_message"] = msg
                            except Exception as e:
                                print(f"Escalation error: {e}")
            except Exception as e:
                print(f"Escalation checker error: {e}")
                await asyncio.sleep(5)


class AuthorityDispatch:
    """
    Tracks authority notifications dispatched for each incident.
    When an incident fires, auto-dispatch is sent to nearest hospital,
    NDRF, and police — logged here and shown on the dashboard.
    """

    def __init__(self):
        self._dispatches: list = []
        self._dispatched_incident_ids: set = set()
        self._counter: int = 0

    def dispatch_for_incident(self, incident: dict, responders: list, monitored_trains: list = None) -> list:
        inc_id = incident.get("id", "")
        if inc_id in self._dispatched_incident_ids:
            return []
        self._dispatched_incident_ids.add(inc_id)

        ts = time.time()
        inc_type = incident.get("type", "incident")
        inc_type_label = inc_type.replace("_", " ").upper()
        lat = incident.get("lat")
        lng = incident.get("lng")
        location_str = f"({lat:.3f}, {lng:.3f})" if lat and lng else "unknown location"
        description = incident.get("description", "")
        coaches = incident.get("estimated_affected_coaches", "?")
        is_signal_mismatch = inc_type == "signal_mismatch"
        new_dispatches = []

        # ── Station Master ────────────────────────────────────────────────
        self._counter += 1
        if is_signal_mismatch:
            sm_msg = (
                f"CRITICAL SIGNAL MISMATCH: {description} "
                f"STOP ALL APPROACHING TRAINS ON THIS SECTION IMMEDIATELY. "
                f"Contact Loco Pilots via VHF/Walkie-Talkie. "
                f"Do NOT allow any train to pass the affected signal until fault is resolved."
            )
        else:
            sm_msg = (
                f"EMERGENCY {inc_type_label}: {description} "
                f"— Estimated {coaches} coaches affected."
            )
        sm = {
            "id": f"DISP-{self._counter:04d}",
            "incident_id": inc_id,
            "authority_name": "Station Master",
            "authority_type": "station_master",
            "contact": "VDU-ALERT",
            "dispatched_at": ts,
            "status": "sent",
            "message": sm_msg,
        }
        self._dispatches.append(sm)
        new_dispatches.append(sm)

        # ── Loco Pilot alert (signal mismatch only) ───────────────────────
        if is_signal_mismatch:
            for train_num in (monitored_trains or []):
                self._counter += 1
                driver = {
                    "id": f"DISP-{self._counter:04d}",
                    "incident_id": inc_id,
                    "authority_name": f"Loco Pilot — Train {train_num}",
                    "authority_type": "driver",
                    "contact": "CAB RADIO / VHF Ch.01",
                    "dispatched_at": ts,
                    "status": "sent",
                    "message": (
                        f"EMERGENCY STOP — Train {train_num}: {description} "
                        f"Signal is displaying incorrect aspect (GREEN on occupied/misaligned section). "
                        f"APPLY EMERGENCY BRAKES. STOP BEFORE SIGNAL. "
                        f"Await clearance from Station Master before proceeding."
                    ),
                }
                self._dispatches.append(driver)
                new_dispatches.append(driver)

        # ── Emergency responders (hospital, ndrf, police) ─────────────────
        for r in responders:
            self._counter += 1
            msg = (
                f"{inc_type_label} at {location_str}. "
                f"{description} "
                f"Est. {coaches} coaches. "
                f"Nearest responder: {r['name']} ({r['distance_km']} km)."
            )
            dispatch = {
                "id": f"DISP-{self._counter:04d}",
                "incident_id": inc_id,
                "authority_name": r["name"],
                "authority_type": r["type"],
                "contact": r["contact"],
                "dispatched_at": ts,
                "status": "sent",
                "message": msg,
            }
            self._dispatches.append(dispatch)
            new_dispatches.append(dispatch)

        print(f"Dispatched {len(new_dispatches)} authority notifications for {inc_id}")
        return new_dispatches

    def get_recent(self, n: int = 30) -> list:
        return list(reversed(self._dispatches[-n:]))


alert_manager = AlertManager()
authority_dispatch = AuthorityDispatch()
