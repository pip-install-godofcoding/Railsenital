"""
Demo Route: 12841 Coromandel Express — Howrah → Bhubaneswar segment.
This is the Balasore corridor — directly relevant to SIH26028.
Provides second-by-second GPS movement, station schedule, and SCADA section mapping.
"""
import math

# Stations with real GPS coordinates and scheduled timing
STATIONS = [
    {"name": "Howrah",        "code": "HWH", "lat": 22.5839, "lng": 88.3426, "dist_km": 0,   "sched_min": 0,   "halt_min": 0},
    {"name": "Kharagpur",     "code": "KGP", "lat": 22.3286, "lng": 87.3191, "dist_km": 121, "sched_min": 72,  "halt_min": 2},
    {"name": "Balasore",      "code": "BLS", "lat": 21.4942, "lng": 86.9355, "dist_km": 214, "sched_min": 130, "halt_min": 2},
    {"name": "Bhadrak",       "code": "BHC", "lat": 21.0585, "lng": 86.5198, "dist_km": 261, "sched_min": 157, "halt_min": 2},
    {"name": "Cuttack",       "code": "CTC", "lat": 20.4625, "lng": 85.8830, "dist_km": 347, "sched_min": 209, "halt_min": 2},
    {"name": "Bhubaneswar",   "code": "BBS", "lat": 20.2673, "lng": 85.8135, "dist_km": 377, "sched_min": 226, "halt_min": 0},
]

TOTAL_DIST_KM = STATIONS[-1]["dist_km"]

# Dense waypoints (lng, lat) for GeoJSON and smooth interpolation
ROUTE_WAYPOINTS = [
    [88.3426, 22.5839],
    [88.2400, 22.5600],
    [88.1200, 22.5400],
    [87.9800, 22.5000],
    [87.8200, 22.4600],
    [87.6500, 22.4200],
    [87.4800, 22.3800],
    [87.3191, 22.3286],  # Kharagpur
    [87.2200, 22.2400],
    [87.1300, 22.1500],
    [87.0600, 22.0200],
    [87.0100, 21.9000],
    [86.9800, 21.7500],
    [86.9600, 21.6200],
    [86.9355, 21.4942],  # Balasore
    [86.8900, 21.3800],
    [86.8200, 21.2700],
    [86.7300, 21.1800],
    [86.6300, 21.1100],
    [86.5198, 21.0585],  # Bhadrak
    [86.4300, 20.9600],
    [86.3200, 20.8500],
    [86.2000, 20.7400],
    [86.1000, 20.6400],
    [85.9800, 20.5500],
    [85.8830, 20.4625],  # Cuttack
    [85.8600, 20.4000],
    [85.8400, 20.3400],
    [85.8200, 20.3000],
    [85.8135, 20.2673],  # Bhubaneswar
]

ROUTE_GEOJSON = {
    "type": "Feature",
    "geometry": {"type": "LineString", "coordinates": ROUTE_WAYPOINTS},
    "properties": {"train_number": "12841", "train_name": "Coromandel Express"},
}

# SCADA track sections: demo train occupies one section at a time
# These align with SCADA T1-T4 track IDs
TRACK_SECTIONS = [
    {"id": "T1", "label": "Howrah–Kharagpur",    "signal": "S1", "start_km": 0,   "end_km": 121},
    {"id": "T2", "label": "Kharagpur–Balasore",  "signal": "S1", "start_km": 121, "end_km": 214},
    {"id": "T3", "label": "Balasore–Bhadrak",    "signal": "S2", "start_km": 214, "end_km": 261},
    {"id": "T4", "label": "Bhadrak–Bhubaneswar", "signal": "S2", "start_km": 261, "end_km": 377},
]

# Demo speed: 30× real time so the 377km route plays in ~13 min
SIM_SPEED_KMH = 100        # displayed speed (km/h)
SIM_MULTIPLIER = 30        # real-time acceleration factor
KM_PER_TICK = SIM_SPEED_KMH * SIM_MULTIPLIER / 3600  # ≈ 0.833 km / second


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_interpolated_pos(dist_km: float) -> tuple[float, float]:
    """Return (lat, lng) for a given distance along the route."""
    total = 0.0
    for i in range(len(ROUTE_WAYPOINTS) - 1):
        lon1, lat1 = ROUTE_WAYPOINTS[i]
        lon2, lat2 = ROUTE_WAYPOINTS[i + 1]
        seg = _haversine(lat1, lon1, lat2, lon2)
        if total + seg >= dist_km:
            ratio = (dist_km - total) / seg if seg > 0 else 0
            return lat1 + (lat2 - lat1) * ratio, lon1 + (lon2 - lon1) * ratio
        total += seg
    lon, lat = ROUTE_WAYPOINTS[-1]
    return lat, lon


def get_track_section(dist_km: float) -> str:
    for sec in TRACK_SECTIONS:
        if sec["start_km"] <= dist_km < sec["end_km"]:
            return sec["id"]
    return "T4"


def get_previous_station(dist_km: float) -> dict:
    prev = STATIONS[0]
    for s in STATIONS:
        if s["dist_km"] <= dist_km:
            prev = s
    return prev


def get_next_station(dist_km: float) -> dict | None:
    for s in STATIONS:
        if s["dist_km"] > dist_km:
            return s
    return None
