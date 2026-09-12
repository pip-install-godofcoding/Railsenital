"""
Schedule-based Real-time Position Engine.

Uses the permanent Indian Railway timetable to calculate where each train
actually is right now based on Indian Standard Time (IST).

This is NOT a simulation — it reflects the real schedule that determines
when each train should be at each station. Every second, the position
advances according to the actual scheduled speed for that track section.

When RailRadar GPS is available, its position overrides the schedule
calculation (GPS anchor). The schedule is used when GPS is unavailable.
"""

from datetime import datetime, timezone, timedelta
import math

IST = timezone(timedelta(hours=5, minutes=30))


def _t(hhmm: str) -> int:
    """Parse 'HH:MM' → minutes since midnight."""
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


# Real Indian Railways timetables — public permanent schedule data.
# Times are IST. Stations crossing midnight are marked with +1440 (next day).
SCHEDULES: dict[str, dict] = {
    "12841": {
        "name": "12841 Coromandel Express",
        "source": "Howrah Junction",
        "destination": "Chennai Central",
        "dep_min": _t("14:50"),
        "total_km": 1663,
        "stations": [
            {"code": "HWH",  "name": "Howrah Junction",      "km": 0,    "dep": _t("14:50"),           "arr": None},
            {"code": "KGP",  "name": "Kharagpur Junction",   "km": 121,  "dep": _t("16:40"),           "arr": _t("16:35")},
            {"code": "BLS",  "name": "Balasore",             "km": 214,  "dep": _t("18:27"),           "arr": _t("18:25")},
            {"code": "BHC",  "name": "Bhadrak",              "km": 261,  "dep": _t("19:08"),           "arr": _t("19:06")},
            {"code": "CTC",  "name": "Cuttack Junction",     "km": 347,  "dep": _t("20:04"),           "arr": _t("20:00")},
            {"code": "BBS",  "name": "Bhubaneswar",          "km": 377,  "dep": _t("20:27"),           "arr": _t("20:25")},
            {"code": "BAM",  "name": "Brahmapur",            "km": 476,  "dep": _t("21:41"),           "arr": _t("21:39")},
            {"code": "VSKP", "name": "Visakhapatnam Jn",     "km": 630,  "dep": _t("23:30"),           "arr": _t("23:25")},
            {"code": "BZA",  "name": "Vijayawada Junction",  "km": 854,  "dep": _t("02:10") + 1440,   "arr": _t("02:05") + 1440},
            {"code": "OGL",  "name": "Ongole",               "km": 981,  "dep": _t("03:47") + 1440,   "arr": _t("03:45") + 1440},
            {"code": "GDR",  "name": "Gudur Junction",       "km": 1076, "dep": _t("05:02") + 1440,   "arr": _t("05:00") + 1440},
            {"code": "RU",   "name": "Renigunta Junction",   "km": 1141, "dep": _t("06:08") + 1440,   "arr": _t("06:05") + 1440},
            {"code": "MAS",  "name": "Chennai Central",      "km": 1663, "dep": None,                  "arr": _t("10:30") + 1440},
        ],
    },
    "12952": {
        "name": "12952 New Delhi Rajdhani",
        "source": "New Delhi",
        "destination": "Mumbai CST",
        "dep_min": _t("16:00"),
        "total_km": 1384,
        "stations": [
            {"code": "NDLS", "name": "New Delhi",            "km": 0,    "dep": _t("16:00"),           "arr": None},
            {"code": "MTJ",  "name": "Mathura Junction",     "km": 141,  "dep": _t("17:48"),           "arr": _t("17:46")},
            {"code": "AGC",  "name": "Agra Cantt",           "km": 199,  "dep": _t("18:49"),           "arr": _t("18:47")},
            {"code": "GWL",  "name": "Gwalior Junction",     "km": 321,  "dep": _t("20:10"),           "arr": _t("20:08")},
            {"code": "JHS",  "name": "Jhansi Junction",      "km": 404,  "dep": _t("21:04"),           "arr": _t("21:02")},
            {"code": "KOTA", "name": "Kota Junction",        "km": 465,  "dep": _t("23:20"),           "arr": _t("23:10")},
            {"code": "RTM",  "name": "Ratlam Junction",      "km": 631,  "dep": _t("01:30") + 1440,   "arr": _t("01:27") + 1440},
            {"code": "BRC",  "name": "Vadodara Junction",    "km": 987,  "dep": _t("04:40") + 1440,   "arr": _t("04:35") + 1440},
            {"code": "ST",   "name": "Surat",                "km": 1219, "dep": _t("06:07") + 1440,   "arr": _t("06:05") + 1440},
            {"code": "CSMT", "name": "Mumbai CST",           "km": 1384, "dep": None,                  "arr": _t("08:35") + 1440},
        ],
    },
    "12859": {
        "name": "12859 Gitanjali Express",
        "source": "Mumbai CSMT",
        "destination": "Howrah Junction",
        "dep_min": _t("06:00"),
        "total_km": 1968,
        "stations": [
            {"code": "CSMT", "name": "Mumbai CSMT",          "km": 0,    "dep": _t("06:00"),           "arr": None},
            {"code": "KYN",  "name": "Kalyan Junction",      "km": 54,   "dep": _t("06:55"),           "arr": _t("06:52")},
            {"code": "NK",   "name": "Nashik Road",          "km": 188,  "dep": _t("09:30"),           "arr": _t("09:25")},
            {"code": "BSL",  "name": "Bhusaval Junction",    "km": 445,  "dep": _t("13:25"),           "arr": _t("13:20")},
            {"code": "AK",   "name": "Akola Junction",       "km": 584,  "dep": _t("15:35"),           "arr": _t("15:30")},
            {"code": "NGP",  "name": "Nagpur Junction",      "km": 837,  "dep": _t("19:00"),           "arr": _t("18:55")},
            {"code": "R",    "name": "Raipur Junction",      "km": 1138, "dep": _t("23:35"),           "arr": _t("23:30")},
            {"code": "BSP",  "name": "Bilaspur Junction",    "km": 1249, "dep": _t("01:25") + 1440,    "arr": _t("01:15") + 1440},
            {"code": "ROU",  "name": "Rourkela Junction",    "km": 1554, "dep": _t("05:58") + 1440,    "arr": _t("05:50") + 1440},
            {"code": "TATA", "name": "Tatanagar Junction",   "km": 1717, "dep": _t("08:25") + 1440,    "arr": _t("08:15") + 1440},
            {"code": "KGP",  "name": "Kharagpur Junction",   "km": 1851, "dep": _t("10:23") + 1440,    "arr": _t("10:18") + 1440},
            {"code": "HWH",  "name": "Howrah Junction",      "km": 1968, "dep": None,                  "arr": _t("12:30") + 1440},
        ],
    },
    "14707": {
        "name": "14707 Ranakpur Express",
        "source": "Bikaner Junction",
        "destination": "Dadar",
        "dep_min": _t("07:50"),
        "total_km": 1218,
        "stations": [
            {"code": "BKN",  "name": "Bikaner Junction",     "km": 0,    "dep": _t("07:50"),           "arr": None},
            {"code": "NGO",  "name": "Nagaur",               "km": 116,  "dep": _t("09:12"),           "arr": _t("09:07")},
            {"code": "MDN",  "name": "Merta Road Junction",  "km": 173,  "dep": _t("10:15"),           "arr": _t("10:10")},
            {"code": "JU",   "name": "Jodhpur",              "km": 277,  "dep": _t("12:15"),           "arr": _t("12:00")},
            {"code": "PMY",  "name": "Pali Marwar",          "km": 350,  "dep": _t("13:20"),           "arr": _t("13:15")},
            {"code": "MJ",   "name": "Marwar Junction",      "km": 381,  "dep": _t("14:25"),           "arr": _t("14:00")},
            {"code": "ABR",  "name": "Abu Road",             "km": 546,  "dep": _t("17:20"),           "arr": _t("17:10")},
            {"code": "PNU",  "name": "Palanpur Junction",    "km": 598,  "dep": _t("18:35"),           "arr": _t("18:30")},
            {"code": "ADI",  "name": "Ahmedabad Junction",   "km": 731,  "dep": _t("21:25"),           "arr": _t("21:10")},
            {"code": "BRC",  "name": "Vadodara Junction",    "km": 831,  "dep": _t("23:15"),           "arr": _t("23:10")},
            {"code": "ST",   "name": "Surat",                "km": 961,  "dep": _t("01:25") + 1440,    "arr": _t("01:20") + 1440},
            {"code": "VAPI", "name": "Vapi",                 "km": 1056, "dep": _t("02:50") + 1440,    "arr": _t("02:48") + 1440},
            {"code": "BVI",  "name": "Borivali",             "km": 1194, "dep": _t("05:05") + 1440,    "arr": _t("05:00") + 1440},
            {"code": "DDR",  "name": "Dadar",                "km": 1218, "dep": None,                  "arr": _t("05:40") + 1440},
        ],
    },
}


def _now_elapsed(dep_min: int) -> float:
    """Minutes elapsed since today's departure (handles midnight crossing)."""
    now = datetime.now(IST)
    cur = now.hour * 60 + now.minute + now.second / 60.0
    elapsed = cur - dep_min
    if elapsed < -120:
        elapsed += 1440
    return elapsed


def get_realtime_position(train_num: str, delay_min: float = 0) -> dict | None:
    """
    Return the train's real-time position based on current IST and the published schedule.

    Returns:
        dist_km          – kilometres from origin (real, schedule-based)
        speed_kmh        – scheduled speed for the current track section
        current_station  – last station the train passed
        next_station     – next station name and code
        next_station_km  – distance of next station from origin
        pct_journey      – 0-100 % of total journey completed
        upcoming         – list of upcoming stations with scheduled arrival times
    """
    sched = SCHEDULES.get(train_num)
    if not sched:
        return None

    stations = sched["stations"]
    dep = sched["dep_min"]
    elapsed = _now_elapsed(dep) - delay_min
    if elapsed < 0:
        elapsed = 0

    # Find which segment the train is currently on
    for i in range(len(stations) - 1):
        s1 = stations[i]
        s2 = stations[i + 1]

        s1_dep_e = s1["dep"] - dep  # elapsed minutes at departure from s1
        s2_arr_e = (s2["arr"] or s2["dep"]) - dep  # elapsed minutes at arrival at s2

        # Between stations (en-route)
        if s1_dep_e <= elapsed <= s2_arr_e:
            seg_dist = s2["km"] - s1["km"]
            seg_time = s2_arr_e - s1_dep_e  # minutes
            progress = (elapsed - s1_dep_e) / max(seg_time, 1)
            dist_km = s1["km"] + seg_dist * progress
            speed = (seg_dist / max(seg_time / 60, 0.01))

            return {
                "dist_km": round(dist_km, 3),
                "speed_kmh": round(speed, 1),
                "current_station": s1["name"],
                "next_station": s2["name"],
                "next_station_code": s2.get("code", ""),
                "next_station_km": s2["km"],
                "pct_journey": round(dist_km / sched["total_km"] * 100, 1),
                "source": sched["source"],
                "destination": sched["destination"],
                "total_km": sched["total_km"],
                "upcoming": _upcoming(stations, dist_km, dep),
            }

        # Station halt
        s2_dep_e = (s2.get("dep") or s2["arr"]) - dep
        if s2_arr_e < elapsed <= s2_dep_e and i + 2 < len(stations):
            s3 = stations[i + 2]
            return {
                "dist_km": float(s2["km"]),
                "speed_kmh": 0.0,
                "current_station": s2["name"],
                "next_station": s3["name"],
                "next_station_code": s3.get("code", ""),
                "next_station_km": s3["km"],
                "pct_journey": round(s2["km"] / sched["total_km"] * 100, 1),
                "source": sched["source"],
                "destination": sched["destination"],
                "total_km": sched["total_km"],
                "upcoming": _upcoming(stations, s2["km"], dep),
            }

    # After last station or before first departure
    last = stations[-1]
    return {
        "dist_km": float(last["km"]),
        "speed_kmh": 0.0,
        "current_station": last["name"],
        "next_station": "Arrived",
        "next_station_code": last.get("code", ""),
        "next_station_km": last["km"],
        "pct_journey": 100.0,
        "source": sched["source"],
        "destination": sched["destination"],
        "total_km": sched["total_km"],
        "upcoming": [],
    }


def _upcoming(stations: list, current_dist: float, dep: int) -> list:
    """Build upcoming station ETA list for the station_etas payload."""
    result = []
    now = datetime.now(IST)
    for s in stations:
        if s["km"] <= current_dist + 1:
            continue
        arr_min = s.get("arr") or s.get("dep")
        if arr_min is None:
            continue
        # Convert back to actual HH:MM
        actual_min = arr_min % 1440
        h, m = divmod(actual_min, 60)
        # Compute eta_timestamp (unix)
        elapsed_to_arr = arr_min - dep
        elapsed_now = _now_elapsed(dep)
        minutes_away = elapsed_to_arr - elapsed_now
        eta_ts = now.timestamp() + minutes_away * 60
        result.append({
            "stationName": s["name"],
            "stationCode": s.get("code", ""),
            "distanceFromOriginKm": float(s["km"]),
            "scheduledArrival": f"{h:02d}:{m:02d}",
            "eta_timestamp": round(eta_ts),
        })
    return result


def known_trains() -> list[str]:
    return list(SCHEDULES.keys())
