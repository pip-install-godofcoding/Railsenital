"""Live responder lookup using OpenStreetMap Overpass API."""
import math, httpx, time

NDRF_UNITS = [
    {"name": "NDRF 1st Bn (Guwahati)",   "type": "ndrf", "lat": 26.1445, "lng": 91.7362,  "contact": "0361-2227505"},
    {"name": "NDRF 2nd Bn (Vadodara)",    "type": "ndrf", "lat": 22.3072, "lng": 73.1812,  "contact": "0265-2411888"},
    {"name": "NDRF 3rd Bn (Mundali)",     "type": "ndrf", "lat": 20.3591, "lng": 85.7948,  "contact": "0674-2561300"},
    {"name": "NDRF 4th Bn (Mumbai)",      "type": "ndrf", "lat": 19.0760, "lng": 72.8777,  "contact": "022-27560451"},
    {"name": "NDRF 5th Bn (Pune)",        "type": "ndrf", "lat": 18.5204, "lng": 73.8567,  "contact": "020-27475000"},
    {"name": "NDRF 7th Bn (Bijnor)",      "type": "ndrf", "lat": 29.3725, "lng": 78.1352,  "contact": "01342-262200"},
    {"name": "NDRF 8th Bn (Ghaziabad)",   "type": "ndrf", "lat": 28.6692, "lng": 77.4538,  "contact": "0120-2756000"},
    {"name": "NDRF 9th Bn (Patna)",       "type": "ndrf", "lat": 25.5941, "lng": 85.1376,  "contact": "0612-2523200"},
    {"name": "NDRF 10th Bn (Kota)",       "type": "ndrf", "lat": 25.1827, "lng": 75.8326,  "contact": "0744-2500567"},
    {"name": "NDRF 11th Bn (Vijayawada)", "type": "ndrf", "lat": 16.5062, "lng": 80.6480,  "contact": "0866-2453500"},
    {"name": "NDRF 12th Bn (Kolkata)",    "type": "ndrf", "lat": 22.5726, "lng": 88.3639,  "contact": "033-25318200"},
]

def _haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

_cache: dict = {}
_CACHE_TTL = 600

def _cache_key(lat, lng):
    return (round(lat, 1), round(lng, 1))

def _fetch_overpass(lat: float, lng: float, radius_km: int = 80) -> list:
    radius_m = radius_km * 1000
    query = (
        "[out:json][timeout:10];"
        "("
        "node[\"amenity\"=\"hospital\"](around:" + str(radius_m) + "," + str(lat) + "," + str(lng) + ");"
        "way[\"amenity\"=\"hospital\"](around:" + str(radius_m) + "," + str(lat) + "," + str(lng) + ");"
        "node[\"amenity\"=\"police\"](around:" + str(radius_m) + "," + str(lat) + "," + str(lng) + ");"
        "way[\"amenity\"=\"police\"](around:" + str(radius_m) + "," + str(lat) + "," + str(lng) + ");"
        ");"
        "out center 25;"
    )
    try:
        resp = httpx.post("https://overpass-api.de/api/interpreter", data={"data": query}, timeout=15)
        data = resp.json()
        results = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("name:en") or tags.get("operator")
            if not name:
                continue
            amenity = tags.get("amenity", "")
            typ = "hospital" if amenity == "hospital" else "police"
            if el["type"] == "node":
                rlat, rlng = el["lat"], el["lon"]
            else:
                center = el.get("center", {})
                rlat = center.get("lat")
                rlng = center.get("lon")
            if not rlat or not rlng:
                continue
            phone = tags.get("phone") or tags.get("contact:phone") or "112"
            dist = round(_haversine(lat, lng, rlat, rlng), 1)
            results.append({"name": name, "type": typ, "lat": rlat, "lng": rlng, "contact": phone, "distance_km": dist})
        return results
    except Exception as e:
        print(f"Overpass error: {e}")
        return []

def nearest_responders(lat: float, lng: float, n: int = 5) -> list:
    key = _cache_key(lat, lng)
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < _CACHE_TTL:
        cached = _cache[key]["data"]
    else:
        live = _fetch_overpass(lat, lng)
        ndrf_nearby = sorted(
            [{**r, "distance_km": round(_haversine(lat, lng, r["lat"], r["lng"]), 1)} for r in NDRF_UNITS],
            key=lambda x: x["distance_km"]
        )[:3]
        cached = live + ndrf_nearby
        _cache[key] = {"ts": now, "data": cached}
    if not cached:
        return sorted(
            [{**r, "distance_km": round(_haversine(lat, lng, r["lat"], r["lng"]), 1)} for r in NDRF_UNITS],
            key=lambda x: x["distance_km"]
        )[:n]
    ranked = sorted(cached, key=lambda x: x["distance_km"])
    top = ranked[:n]
    types_present = {r["type"] for r in top}
    for needed in ("hospital", "police", "ndrf"):
        if needed not in types_present:
            for r in ranked[n:]:
                if r["type"] == needed:
                    top.append(r)
                    break
    return sorted(top, key=lambda x: x["distance_km"])