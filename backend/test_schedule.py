import schedule_engine
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))
now = datetime.now(IST)
print("IST now:", now.strftime("%H:%M:%S"))

for t in ["12841", "12952"]:
    sched = schedule_engine.SCHEDULES[t]
    dep = sched["dep_min"]
    elapsed = schedule_engine._now_elapsed(dep)
    print(f"\n=== {t} ===")
    print(f"  Departs at {dep//60}:{dep%60:02d} IST, elapsed = {elapsed:.1f} min")

    pos = schedule_engine.get_realtime_position(t, 0)
    if pos:
        print(f"  Position: {pos['dist_km']} km, speed={pos['speed_kmh']} km/h")
        print(f"  Current station: {pos['current_station']}")
        print(f"  Next station: {pos['next_station']}")
    else:
        print("  *** RETURNED NONE ***")

    # Show all segment boundaries
    stations = sched["stations"]
    for i in range(len(stations) - 1):
        s1, s2 = stations[i], stations[i + 1]
        s1_dep_e = s1["dep"] - dep
        s2_arr = s2["arr"] or s2["dep"]
        s2_arr_e = s2_arr - dep if s2_arr else 0
        marker = " <-- HERE" if s1_dep_e <= elapsed <= s2_arr_e else ""
        print(f"  {s1['code']}->{s2['code']}: elapsed_range [{s1_dep_e:.0f}, {s2_arr_e:.0f}] min (km {s1['km']}-{s2['km']}){marker}")
