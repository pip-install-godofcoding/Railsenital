"""Registry of hospitals, NDRF units, and police stations near the demo routes."""
import math

RESPONDERS = [
    # ── Rajdhani corridor (Delhi → Mumbai) ──────────────────────────────
    {"name": "AIIMS New Delhi",               "type": "hospital", "lat": 28.5672, "lng": 77.2100, "contact": "011-26588500"},
    {"name": "Sawai Man Singh Hospital, Jaipur","type": "hospital","lat": 26.9124, "lng": 75.7873, "contact": "0141-2518888"},
    {"name": "Kota NDRF 10th Battalion",       "type": "ndrf",    "lat": 25.1827, "lng": 75.8326, "contact": "0744-2500567"},
    {"name": "Surat Civil Hospital",           "type": "hospital", "lat": 21.1930, "lng": 72.8301, "contact": "0261-2244000"},
    {"name": "Mumbai NDRF 4th Battalion",      "type": "ndrf",    "lat": 19.0760, "lng": 72.8777, "contact": "022-27560451"},
    {"name": "Delhi Police HQ",               "type": "police",   "lat": 28.6315, "lng": 77.2206, "contact": "011-23490000"},
    {"name": "Kota GRP",                      "type": "police",   "lat": 25.1800, "lng": 75.8300, "contact": "0744-2326999"},
    {"name": "Mumbai GRP",                    "type": "police",   "lat": 18.9400, "lng": 72.8350, "contact": "022-22621855"},

    # ── Coromandel corridor (Howrah → Chennai) ──────────────────────────
    {"name": "SSKM Hospital Kolkata",          "type": "hospital", "lat": 22.5354, "lng": 88.3411, "contact": "033-22041739"},
    {"name": "Balasore District Hospital",     "type": "hospital", "lat": 21.4942, "lng": 86.9355, "contact": "06782-262350"},
    {"name": "AIIMS Bhubaneswar",             "type": "hospital", "lat": 20.2673, "lng": 85.8135, "contact": "0674-2476789"},
    {"name": "Odisha NDRF 3rd Battalion",     "type": "ndrf",    "lat": 20.2961, "lng": 85.8245, "contact": "0674-2561300"},
    {"name": "King George Hospital, Vizag",   "type": "hospital", "lat": 17.7231, "lng": 83.3012, "contact": "0891-2564891"},
    {"name": "Visakhapatnam NDRF",           "type": "ndrf",    "lat": 17.6868, "lng": 83.2185, "contact": "0891-2512600"},
    {"name": "Chennai Rajiv Gandhi GH",       "type": "hospital", "lat": 13.0736, "lng": 80.2784, "contact": "044-25305000"},
    {"name": "Howrah GRP",                   "type": "police",   "lat": 22.5852, "lng": 88.3425, "contact": "033-26382111"},
    {"name": "Kharagpur GRP",               "type": "police",   "lat": 22.3300, "lng": 87.3200, "contact": "03222-255111"},
    {"name": "Balasore SP Office",           "type": "police",   "lat": 21.4950, "lng": 86.9370, "contact": "06782-262222"},
    {"name": "Bhadrak District Police",      "type": "police",   "lat": 21.0590, "lng": 86.5210, "contact": "06784-251222"},
    {"name": "Bhubaneswar Police Commissionerate","type": "police","lat": 20.2680, "lng": 85.8400, "contact": "0674-2532070"},
    {"name": "Visakhapatnam City Police",    "type": "police",   "lat": 17.6900, "lng": 83.2200, "contact": "0891-2562100"},
    {"name": "Chennai GRP",                  "type": "police",   "lat": 13.0800, "lng": 80.2760, "contact": "044-25351100"},
]


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearest_responders(lat: float, lng: float, n: int = 5) -> list:
    """Return the n closest responders sorted by distance, always including at least
    one hospital, one ndrf/police if available."""
    ranked = sorted(
        [{**r, "distance_km": round(_haversine(lat, lng, r["lat"], r["lng"]), 1)}
         for r in RESPONDERS],
        key=lambda x: x["distance_km"],
    )
    # Ensure diversity: take top n but guarantee hospital + police are present
    top = ranked[:n]
    types_present = {r["type"] for r in top}
    for needed in ("hospital", "police"):
        if needed not in types_present:
            for r in ranked[n:]:
                if r["type"] == needed:
                    top.append(r)
                    break
    return sorted(top, key=lambda x: x["distance_km"])
